(function () {
    'use strict';

    //reloading angular module and creating the home service
    angular.module('main').service('outdoorService', outdoorService);

    outdoorService.$inject = ['$mdDialog', '$interval', '$state', 'newSocketService', 'dataService'];

    function outdoorService($mdDialog, $interval, $state, newSocketService, dataService) {
        let outdoor_service = this;

        /**
         * Function that control if the marker passed as parameter has to be displayed on the map
         * @param marker
         * @param tags
         * @returns {boolean}
         */
        outdoor_service.isMarkerStillOnMap = (marker, tags) => {
            return tags.some(ot => marker.getPosition().lat() === ot.gps_north_degree && marker.getPosition().lng() === ot.gps_east_degree)
        };

        /**
         * Function that get the index of the marker passed as parameter from the array of marked passed as parameter also
         */
        outdoor_service.markerIsOnMap = (markers, marker) => {
            return markers.findIndex(m => m.getPosition().equals(marker.getPosition()));
        };

        /**
         * Function that sets an icon image to the marker passed as parameter
         * @param tag
         * @param marker
         * @param offline
         */
        outdoor_service.setIcon = (tag, marker, offline) => {
            if (tag.sos) {
                marker.setIcon(tagsIconPath + 'sos_24.png');
            } else if (tag.man_down) {
                marker.setIcon(tagsIconPath + 'man_down_24.png');
            } else if (tag.battery_status) {
                marker.setIcon(tagsIconPath + 'battery_low_24.png');
            } else if (tag.helmet_dpi) {
                marker.setIcon(tagsIconPath + 'helmet_dpi_24.png');
            } else if (tag.belt_dpi) {
                marker.setIcon(tagsIconPath + 'belt_dpi_24.png');
            } else if (tag.glove_dpi) {
                marker.setIcon(tagsIconPath + 'glove_dpi_24.png');
            } else if (tag.shoe_dpi) {
                marker.setIcon(tagsIconPath + 'shoe_dpi_24.png');
            } else if (tag.man_down_disabled) {
                marker.setIcon(tagsIconPath + 'man-down-disabled_24.png');
            } else if (tag.man_down_tacitated) {
                marker.setIcon(tagsIconPath + 'man-down-tacitated_24.png');
            } else if (tag.man_in_quote) {
                marker.setIcon(tagsIconPath + 'man_in_quote_24.png');
            } else if (tag.call_me_alarm) {
                marker.setIcon(tagsIconPath + 'call_me_alarm_24.png');
            } else if (offline){
                marker.setIcon(tagsIconPath + 'offline_tag_24.png');
            } else {
                marker.setIcon(tagsIconPath + 'online_tag_24.png');
            }
        };

        /**
         * Function that sets the icon of the online tag for the passed marker
         * @param tags
         */
        outdoor_service.checkIfTagsHaveAlarmsOutdoor = (tags) => {
            return tags.some(outdoor_service.isTagInLocation(tag, {radius: dataService.location.radius, position: [dataService.location.latitude, dataService.location.longitude]})
                && (tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                || tag.call_me_alarm || tag.diagnostic_request));
        };

        // already in service
        // /**
        //  * Function tat control if the tag is in the location
        //  * @param tag
        //  * @param location
        //  * @returns {boolean}
        //  */
        // outdoor_service.isTagInLocation = (tag, location) => {
        //     return dataService.getTagDistanceFromLocationOrigin(tag, location.position) <= location.radius;
        // };
    }
})();