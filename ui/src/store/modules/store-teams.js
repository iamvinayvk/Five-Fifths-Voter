import teamApi from '../../api/team-api';
import accessApi from '../../api/access-api';
import electionsApi from '../../api/elections-api';
import readableId from '../../api/base58id';

import lodash from 'lodash';
import Vue from 'vue';

// initial state
const state = () => ({
  current: {
    display_name: '',
    description: '',
    slug: '',
    election: ''
  },
  teamAccess: [], // for current team
  access: [], // for current user
  elections: [], // elections in this team
  contests: [], // contests in this team
  local: { votes: {}, tags: [] }
});

// getters
const getters = {
  isUserEditor: (state, getters, rootState) => {
    try {
      let doc = state.access.find(access => access.team === state.current.slug);
      let isEditor = doc && (doc.acl === 'admin' || doc.acl === 'editor');
      if (!isEditor) {
        // maybe this is a new team, and we did not yet get an owner access document from the db
        isEditor = rootState.user.info.sub === state.current.creator_sub;
      }
      return isEditor;
    } catch (error) {
      //eslint-disable-next-line no-console
      console.log(error);
      return false;
    }
  },
  mergeContests: state => {
    try {
      const merged = [];
      state.contests.forEach(doc => {
        merged.push(
          doc.contests.map((c, index) => ({
            ...c,
            doc_id: doc._id,
            doc_index: index,
            doc_election: doc.election
          }))
        );
      });

      return lodash.flatten(merged);
    } catch (error) {
      //eslint-disable-next-line no-console
      console.log(error);
      return [];
    }
  }
};

// actions
const actions = {
  async loadCurrent({ commit }, teamId) {
    let doc = await teamApi.get(teamId);
    if (doc) commit('setCurrent', doc);
  },

  /**
   * Load the access docs for the current team
   */
  async loadTeamAccess({ commit, state }) {
    let docs = await accessApi.getTeam(state.current.slug);
    if (docs) commit('setTeamAccessDocs', docs);
  },

  /**
   * Load election documents for the current team
   */
  async loadTeamElections({ commit, state }) {
    commit('clearTeamElectionDocs');
    let docs = await electionsApi.get(state.current.slug);
    if (docs.ok === false) return;
    if (docs) commit('addTeamElectionDocs', docs);
  },
  async removeTeamElection({ commit, state }, payload) {
    try {
      let result = await electionsApi.delete(state.current.slug, payload._id);
      if (result.ok) commit('removeTeamElection', payload._id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`could not delete election ${payload.name}`);
    }
  },

  /**
   * Load the contest docs for the current team
   */
  async loadTeamContests({ commit, state }) {
    commit('clearTeamContestDocs');

    let docs = await electionsApi.getContests(state.current.slug);
    if (docs.ok === false) return;

    // fixup any contests and candidates that do not have a unique id assigned.
    let dirty = false;
    for (const contest of docs) {
      for (const c of contest.contests || []) {
        if (!c.id) {
          dirty = true;
          c.id = readableId(5);
        }
        for (const person of c.candidates || []) {
          if (!person.id) {
            dirty = true;
            person.id = readableId(5);
          }
        }
      }
      if (dirty) {
        await electionsApi.updateContest(state.current.slug, contest);
      }
    }

    if (docs) commit('addTeamContestDocs', docs);
  },
  async removeContest({ commit, state }, payload) {
    try {
      // find the doc that has this contest
      const doc = state.contests.find(doc => doc._id === payload.doc_id);
      const found = doc.contests.find(item => item.id === payload.id);

      // If there is only one contest in this document, remove the whole document
      if (found && doc.contests.length === 1) {
        let result = await electionsApi.deleteContest(state.current.slug, doc._id);
        if (result.ok) commit('removeTeamContest', doc);
      } else if (found) {
        // if there are multiple contests in this document, remove just the one
        const update = lodash.cloneDeep(doc);
        update.contests.splice(payload.doc_index, 1);
        // eslint-disable-next-line no-console
        console.log(payload, 'doc', update);
        let result = await electionsApi.updateContest(state.current.slug, update);
        if (result.ok) commit('addTeamContestDocs', update);
      } else {
        // eslint-disable-next-line no-console
        console.error(`could not delete contest ${payload.id}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`could not delete contest`, error);
    }
  },
  async addContestInfo({ commit, state }, info) {
    let contest = state.contests.find(c => c.election === state.current.election);
    if (!contest) {
      contest = {
        team: state.current.slug,
        election: state.current.election,
        contests: [info]
      };
      let resp = await electionsApi.addContests(state.current.slug, contest);
      if (resp) commit('addTeamContestDocs', resp.doc);
    } else {
      let resp = await electionsApi.addContestInfo(state.current.slug, contest, info);
      if (resp) commit('addTeamContestDocs', { ...contest, contests: resp });
    }
  },
  async addCandidateContest({ commit, state }, data) {
    let added = false;
    try {
      let doc = state.contests.find(contest => contest._id === data.contest.doc_id);
      let update = lodash.cloneDeep(doc);
      const contest = update.contests.find(c => c.id === data.contest.id);
      if (!contest.candidates) contest.candidates = [];
      const index = contest.candidates.findIndex(person => person.id === data.candidate.id);
      if (index > -1) contest.candidates.splice(index, 1, data.candidate);
      else contest.candidates.push(data.candidate);

      let result = await electionsApi.updateContest(state.current.slug, update);
      if (result.ok) {
        commit('addTeamContestDocs', update);
        added = true;
      } else {
        // eslint-disable-next-line no-console
        console.error(`could not update candidate ${data.candidate.name}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`could not update candidate`, error);
    }
    return added;
  },

  async removeCandidateContest({ commit, state }, data) {
    let success = false;
    try {
      let doc = state.contests.find(contest => contest._id === data.contest.doc_id);
      let update = lodash.cloneDeep(doc);
      const contest = update.contests.find(c => c.id === data.contest.id);
      if (!contest.candidates) contest.candidates = [];
      const index = contest.candidates.findIndex(person => person.id === data.candidate.id);
      if (index > -1) {
        contest.candidates.splice(index, 1);
        let result = await electionsApi.updateContest(state.current.slug, update);
        if (result.ok) {
          commit('addTeamContestDocs', update);
          success = true;
        } else {
          // eslint-disable-next-line no-console
          console.error(`could not update candidate ${data.candidate.name}`);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`could not update candidate`, error);
    }
    return success;
  },

  /**
   * Load the access docs associated with the current user. The list will have
   * open invitations as well as teams where the user already has access
   */
  async loadAccess({ commit }) {
    let docs = await accessApi.get();
    if (docs) commit('setAccessDocs', docs);
  },

  /**
   * Update an invitation for the current logged-in user
   * @param {object} payload The the id of an existing access document and acl for the update
   * @returns {Boolean} true if the invitation is update successfully
   */
  async updateInvite({ commit, state }, payload) {
    let doc = state.access.find(access => access.team === payload.id);
    if (doc) {
      let update = { ...doc, status: payload.status };
      let result = await accessApi.updateInvite(update);
      if (result.ok) commit('setAccessDoc', update);
      return result.ok;
    }
    return false;
  },

  /**
   * Create or update and invitation for the current team
   * @param {*} payload
   * @returns {Boolean} true if the invite is created/updated
   */
  async sendTeamInvite({ state, dispatch }, payload) {
    let doc = state.teamAccess.find(
      access => access.email === payload.email || access._id === payload._id
    );
    if (doc) return dispatch('updateTeamInvite', payload);
    else return dispatch('addTeamInvite', payload);
  },

  /**
   * Add an invitation to the current team. Only admins and editors can invite new users
   * @param {Object} payload - access document to send to the db. See services/api/models/model-access.js
   * @returns {Boolean} true if the invitation is created
   */
  async addTeamInvite({ commit, state }, payload) {
    let invite = {
      ...payload,
      email: payload.email.toLowerCase(),
      team: state.current.slug
    };
    let doc = state.teamAccess.find(
      access => access.email === invite.email || access._id === invite._id
    );
    if (!doc) {
      let result = await accessApi.addInvite(invite);
      if (result.ok) commit('setTeamAccessDoc', result.doc);
      return result.ok;
    }
    return false;
  },

  /**
   * Update an invitation to the current team. Only admins and editors can invite new users
   * @param {Object} payload - access document to send to the db. See services/api/models/model-access.js
   * @returns {Boolean} true if the invitation is created
   */
  async updateTeamInvite({ commit, state }, payload) {
    let invite = {
      ...payload,
      email: payload.email.toLowerCase(),
      team: state.current.slug
    };
    let doc = state.teamAccess.find(
      access => access.email === invite.email || access._id === invite._id
    );
    if (doc) {
      let update = { ...doc, ...invite };
      let result = await accessApi.updateTeamInvite(update);
      if (result.ok) commit('setTeamAccessDoc', update);
      return result.ok;
    }
    return false;
  },

  async addVote({ commit, state }, payload) {
    try {
      let update = lodash.cloneDeep(state.local);
      if (!update) update = { votes: {}, tags: [] };
      if (!update.votes) update.votes = {};
      update.votes[payload.contest.id] = {
        ...lodash.cloneDeep(payload.candidate),
        office: payload.contest.office || payload.contest.referendumTitle
      };
      commit('setLocal', update);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`could not update vote`, error);
    }
  },
  removeVote({ commit, state }, id) {
    try {
      let update = lodash.cloneDeep(state.local);
      if (!update) update = { votes: {}, tags: [] };
      if (!update.votes) update.votes = {};
      update.votes = lodash.omit(update.votes, [id]);
      commit('setLocal', update);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`could not update vote`, error);
    }
  },
  addTag({ commit, state }, payload) {
    try {
      let update = lodash.cloneDeep(state.local);
      if (!update) update = { votes: {}, tags: [] };
      if (!update.tags) update.tags = [];
      const index = update.tags.findIndex(tag => lodash.isEqual(tag, payload));
      if (index === -1) {
        update.tags.push(payload);
        commit('setLocal', update);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`could not add tag`, e);
    }
  },
  removeTag({ commit, state }, payload) {
    try {
      let update = lodash.cloneDeep(state.local);
      if (!update) update = { votes: {}, tags: [] };
      if (!update.tags) update.tags = [];
      const index = update.tags.findIndex(tag => lodash.isEqual(tag, payload));
      if (index >= -1) {
        update.tags.splice(index, 1);
        commit('setLocal', update);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`could not remove tag`, e);
    }
  }
};

// mutations
const mutations = {
  setCurrent(state, data) {
    state.current = data;
  },
  setTeamAccessDocs(state, data) {
    state.teamAccess = data;
  },
  clearTeamElectionDocs(state) {
    state.elections.splice(0);
  },
  addTeamElectionDocs(state, data) {
    let update;
    if (Array.isArray(data)) update = data;
    else update = [data];

    update.forEach(doc => {
      let index = state.elections.findIndex(contest => contest._id === doc._id);
      if (index > -1) state.elections.splice(index, 1, doc);
      else state.elections.push(doc);
    });
    if (!state.current.election && state.elections.length > 0)
      Vue.set(state.current, 'election', state.elections[0]._id);
  },
  removeTeamElection(state, id) {
    let index = state.elections.findIndex(doc => doc._id === id);
    if (index > -1) state.elections.splice(index, 1);
  },
  selectElection(state, id) {
    Vue.set(state.current, 'election', id);
  },
  clearTeamContestDocs(state) {
    state.contests.splice(0);
  },
  addTeamContestDocs(state, data) {
    let update;
    if (Array.isArray(data)) update = data;
    else update = [data];

    update.forEach(doc => {
      let index = state.contests.findIndex(contest => contest._id === doc._id);
      if (index > -1) state.contests.splice(index, 1, doc);
      else state.contests.push(doc);
    });
  },
  removeTeamContest(state, data) {
    let index = state.contests.findIndex(contest => contest._id === data._id);
    if (index > -1) state.contests.splice(index, 1);
  },

  setTeamAccessDoc(state, data) {
    let index = state.teamAccess.findIndex(ta => ta._id === data._id);
    if (index > -1) state.teamAccess.splice(index, 1, data);
    else state.teamAccess.push(data);
  },
  setAccessDocs(state, data) {
    state.access = data;
  },
  setAccessDoc(state, data) {
    let index = state.access.findIndex(access => access._id === data._id);
    if (index > -1) state.access.splice(index, 1, data);
    else state.access.push(data);
  },
  loadLocal(state) {
    try {
      let data = localStorage.getItem(state.current.slug);
      state.local = JSON.parse(data) || { votes: {}, tags: [] };
      if (!state.local.votes) state.local.votes = {};
      if (!state.local.tags) state.local.tags = [];
    } catch (error) {
      state.local = { votes: {}, tags: [] };
    }
  },
  setLocal(state, data) {
    try {
      state.local = data;
      localStorage.setItem(state.current.slug, JSON.stringify(data));
    } catch (error) {
      // ignore
    }
  }
};

export default {
  namespaced: false,
  state,
  getters,
  actions,
  mutations
};