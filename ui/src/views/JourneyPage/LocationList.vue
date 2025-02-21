<template>
  <cv-accordion v-if="earlyVoteSites.length || earlyVoteSites.length || dropOffLocations.length">
    <cv-accordion-item v-if="earlyVoteSites.length" :open="false">
      <template v-slot:title>Early Voting Location</template>
      <template v-slot:content>
        <cv-list>
          <cv-list-item v-for="(item, index) in earlyVoteSites" :key="index">
            <span class="loc-name">{{ item.address.locationName }}</span>

            <span v-if="item.address.line1" class="loc-line">{{ item.address.line1 }}</span>
            <span v-if="item.address.line2" class="loc-line">{{ item.address.line2 }}</span>
            <span v-if="item.address.line3" class="loc-line">{{ item.address.line3 }}</span>
            <span v-if="item.address.city" class="loc-city">{{ item.address.city }}</span>
            <span v-if="item.address.state" class="loc-state">
              {{ item.address.state }}
            </span>
            <div>
              <cv-link :href="directionsLink(item)" target="_blank">
                <map-icon style="color: #0f62fe" />
                <span class="location__directions">{{ $t('mapDirections') }}</span>
              </cv-link>
            </div>

            <!-- hours -->
            <div v-for="(h, hi) in formatHours(item.pollingHours)" :key="`${item.address}-h${hi}`">
              <span class="loc-line">{{ h }}</span>
            </div>
          </cv-list-item>
        </cv-list>
      </template>
    </cv-accordion-item>
    <cv-accordion-item v-if="pollingLocations.length" :open="false">
      <template v-slot:title>Election Day Voting Location</template>
      <template v-slot:content>
        <cv-list>
          <cv-list-item v-for="(item, index) in pollingLocations" :key="index">
            <span class="loc-name">{{ item.address.locationName }}</span>
            <span v-if="item.address.line1" class="loc-line">{{ item.address.line1 }}</span>
            <span v-if="item.address.line2" class="loc-line">{{ item.address.line2 }}</span>
            <span v-if="item.address.line3" class="loc-line">{{ item.address.line3 }}</span>
            <span v-if="item.address.city" class="loc-city">{{ item.address.city }}</span>
            <span v-if="item.address.state" class="loc-state">
              {{ item.address.state }}
            </span>
            <div>
              <cv-link :href="directionsLink(item)" target="_blank">
                <map-icon style="color: #0f62fe" />
                <span class="location__directions">{{ $t('mapDirections') }}</span>
              </cv-link>
            </div>

            <!-- hours -->
            <div v-for="(h, hi) in formatHours(item.pollingHours)" :key="`${item.address}-h${hi}`">
              <span class="loc-line">{{ h }}</span>
            </div>
          </cv-list-item>
        </cv-list>
      </template>
    </cv-accordion-item>
    <cv-accordion-item v-if="dropOffLocations.length" :open="false">
      <template v-slot:title>Ballot Drop-off locations</template>
      <template v-slot:content>
        <cv-list>
          <cv-list-item v-for="(item, index) in dropOffLocations" :key="index">
            <span class="loc-name">{{ item.address.locationName }}</span>
            <span v-if="item.pollingHours" class="loc-name">{{ item.pollingHours }}</span>

            <span v-if="item.address.line1" class="loc-line">{{ item.address.line1 }}</span>
            <span v-if="item.address.line2" class="loc-line">{{ item.address.line2 }}</span>
            <span v-if="item.address.line3" class="loc-line">{{ item.address.line3 }}</span>
            <span v-if="item.address.city" class="loc-city">{{ item.address.city }}</span>
            <span v-if="item.address.state" class="loc-state">
              {{ item.address.state }}
            </span>
            <cv-link :href="directionsLink(item)" target="_blank">
              <map-icon style="color: #0f62fe" />
              <span class="location__directions">{{ $t('mapDirections') }}</span>
            </cv-link>
          </cv-list-item>
        </cv-list>
      </template>
    </cv-accordion-item>
  </cv-accordion>
</template>

<script>
import { Map32 } from '@carbon/icons-vue';

export default {
  name: 'LocationList',
  components: { MapIcon: Map32 },
  props: {
    votingData: {
      type: Object,
      default: () => {
        return {
          pollingLocations: [],
          earlyVoteSites: [],
          dropOffLocations: [],
        };
      },
    },
  },
  computed: {
    pollingLocations() {
      return this.votingData?.pollingLocations || [];
    },
    earlyVoteSites() {
      return this.votingData?.earlyVoteSites || [];
    },
    dropOffLocations() {
      return this.votingData?.dropOffLocations || [];
    },
  },
  methods: {
    /**
     * Create a Google link to directions
     */
    directionsLink(item) {
      let dir_address = '';
      if (item.address.line1) dir_address += item.address.line1;
      if (item.address.line2) dir_address += ' ' + item.address.line2;
      if (item.address.line3) dir_address += ' ' + item.address.line3;
      if (item.address.city) dir_address += ' ' + item.address.city;
      if (item.address.state) dir_address += ' ' + item.address.state;
      const escapedValue = encodeURIComponent(dir_address).replaceAll('%20', '+');
      const dir_link = 'https://www.google.com/maps/search/?api=1&query=' + escapedValue;
      return dir_link;
    },
    formatHours(hours) {
      return (hours || '').split('\n');
    },
  },
};
</script>

<style lang="scss">
@import '@/styles/_theme.scss';
.location {
  &__directions {
    margin-top: 0.75rem;
  }
}
</style>
