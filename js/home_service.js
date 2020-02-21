(function () {
    'use strict';

    //reloading angular module and creating the home service
    angular.module('main').service('homeService', homeService);

    homeService.$inject = ['$mdDialog', '$interval', '$state', 'newSocketService'];

    function homeService($mdDialog, $interval, $state, newSocketService) {
        let home_service = this;

        /**
         * Function that create a Google Maps InfoWindow with the informations passed as parameters
         * @param marker
         * @param userTags
         * @param userAnchors
         * @returns InfoWindow
         */
        home_service.fillInfoWindowInsideLocation = (marker, userTags, userAnchors) => {
            // getting the current marker tags
            let locationTags    = home_service.getIndoorLocationTags(marker, userTags);
            //getting the current marker anchors
            let locationAnchors = home_service.getLocationAnchors(marker, userAnchors);

            // creating the content of the window
            return new google.maps.InfoWindow({
                content: '<div class="marker-info-container">' +
                    '<img src="' + markersIconPath + marker.icon + '" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
                    '<p class="text-center font-large font-bold color-darkcyan">' + marker.name.toUpperCase() + '</p>' +
                    '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + marker.position[0] + '</b></p></div>' +
                    '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + marker.position[1] + '</b></p></div>' +
                    '<div class="clear-float display-flex"><div class="width-50 margin-left-10-px"><img src="' + iconsPath + 'offline_tags_alert_30.png" class="margin-right-5-px"><span class="font-large vertical-align-super color-red"><b>' + locationTags.length + '</b></span>' +
                    '</div><div class="width-45 "><img src="' + iconsPath + 'offline_anchors_alert_30.png" class="margin-right-10-px"><span class="font-large vertical-align-super color-red"><b>' + locationAnchors.length + '</b></span></div></div>' +
                    '</div>'
            });
        };

        /**
         * Function that get all the tags in the location indoor passed as parameter
         * @param location
         * @param tags
         * @returns {*}
         */
        home_service.getIndoorLocationTags = (location, tags) => {
            return tags.filter(t => (location.position[0] === t.location_latitude && location.position[1] === t.location_longitude))
        };

        /**
         * Function that get all the anchors in the location indoor passed as parameter
         * @param location
         * @param anchors
         * @returns {*}
         */
        home_service.getLocationAnchors = (location, anchors) => {
            return anchors.filter(a => (a.location_latitude === location.position[0] && a.location_longitude === location.position[1]));
        };

        /**
         * Function that check if at least one of the passed anchors has an alarm
         * @param anchors
         * @returns {boolean}
         */
        home_service.checkIfAnchorsHaveAlarmsOrAreOffline = (anchors) => {
            return anchors.some(a => a.battery_status || a.is_offline === 1);
        };

        /**
         * Function that controls if the alarms array passed as parameter contains an alarm in the location passed as parameter
         * @param alarms
         * @param location
         * @returns {boolean}
         */
        home_service.alarmLocationsContainLocation = (alarms, location) => {
            return alarms.some(l => l.position[0] === location.position[0] && l.position[1] === location.position[1])
        };

        /**
         * Function that checks if the passed tag is out of all the locations
         * @param locations
         * @param tag
         * @returns {boolean}
         */
        home_service.checkIfAnyTagOutOfLocation = (locations, tag) => {
            return locations.some(l => {
                if (!l.is_inside) {
                    // control if the tag is out of the current location (l)
                    return (service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius);
                }
            })
        };

        /**
         * Function that controls if the tag passed as parameter is an outdoor tag without any location
         * @param tag
         * @returns {boolean|boolean}
         */
        home_service.isOutdoorWithoutLocation = (tag) => {
            return tag.gps_north_degree === -2 && tag.gps_east_degree === -2;
        };
    }
})();