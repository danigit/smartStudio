(function () {
    'use strict';

    //reloading angular module and creating the home service
    angular.module('main').service('homeService', homeService);

    homeService.$inject = ['$mdDialog', '$interval', '$state', 'newSocketService', 'dataService'];

    function homeService($mdDialog, $interval, $state, newSocketService, dataService) {
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
         * Function taht create a Google Maps InfoWindow with the informations passed as parameters
         * @param marker
         * @param userTags
         * @returns {google.maps.InfoWindow}
         */
        home_service.fillInfoWindowOutsideLocation = (marker, userTags) => {
            // getting the current marker tags
            let locationTags = home_service.getOutdoorLocationTags(marker, userTags);

            // filling the info window
            return new google.maps.InfoWindow({
                content: '<div class="marker-info-container">' +
                    '<img src="' + markersIconPath + marker.icon + '" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
                    '<p class="text-center font-large font-bold color-darkcyan">' + marker.name.toUpperCase() + '</p>' +
                    '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + marker.position[0] + '</b></p></div>' +
                    '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + marker.position[1] + '</b></p></div>' +
                    '<div class="clear-float display-flex"><div class="margin-auto"><img src="' + iconsPath + 'offline_tags_alert_30.png" class="margin-right-5-px"><span class="font-large vertical-align-super color-red"><b>' + locationTags.length + '</b></span>' +
                    '</div></div' +
                    '</div>'
            });
        };

        /**
         * Function that gets the tags inside the outdoor location passed as parameter
         * @param location
         * @param tags
         * @returns {*}
         */
        home_service.getOutdoorLocationTags = (location, tags) => {
            return tags.filter(t => !location.is_inside && dataService.isTagInLocation(t, location));
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
                    return (dataService.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius);
                }
            })
        };

        /**
         * Function that controls if the tag passed as parameter is an outdoor tag without any location
         * @param tag
         * @returns {boolean|boolean}
         */
        home_service.hasTagAnInvalidGps = (tag) => {
            return tag.gps_north_degree === -2 && tag.gps_east_degree === -2;
        };

        /**
         * Function that controls if the tag passed as parameter in not outside of every location
         * @param tag
         * @returns {boolean|boolean}
         */
        home_service.hasTagAValidGps= (tag) => {
            return tag.gps_north_degree !== -2 && tag.gps_east_degree !== -2;
        };

        home_service.getTagsWithoutAnyLocation = (outdoorLocationTags, locations) => {
            let outdoorNoLocationTags = [];

            outdoorLocationTags.forEach(tag => {
                if (!locations.some(l => dataService.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius)) {
                    if (!dataService.tagsArrayNotContainsTag(outdoorNoLocationTags, tag))
                        outdoorNoLocationTags.push(tag);
                }
            });

            return outdoorNoLocationTags;
        };

        // /**
        //  * Function that creates the alarms to show in the alarms window
        //  * @param tag
        //  * @param locations
        //  * @param tagLocation
        //  * @returns {[]}
        //  */
        // home_service.loadTagAlarmsForInfoWindow = (tag, tagLocation) => {
        //     let alarms = [];
        //
        //     if (tag.sos) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.sos, lang.helpRequest,tagsIconPath + 'sos_24.png', tagLocation));
        //     }
        //     if (tag.man_down) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.manDown, lang.manDown, tagsIconPath + 'man_down_24.png', tagLocation));
        //     }
        //     if (tag.battery_status) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.batteryEmpty, lang.batteryEmpty, tagsIconPath + 'battery_low_24.png', tagLocation));
        //     }
        //     if (tag.helmet_dpi) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.helmetDpi, lang.helmetDpi, tagsIconPath + 'helmet_dpi_24.png', tagLocation));
        //     }
        //     if (tag.belt_dpi) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.beltDpi, lang.beltDpi, tagsIconPath + 'belt_dpi_24.png', tagLocation));
        //     }
        //     if (tag.glove_dpi) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.gloveDpi, lang.gloveDpi, tagsIconPath + 'glove_dpi_24.png', tagLocation));
        //     }
        //     if (tag.shoe_dpi) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.shoeDpi, lang.shoeDpi, tagsIconPath + 'shoe_dpi_24.png', tagLocation));
        //     }
        //     if (tag.man_down_disabled) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.manDownDisabled, lang.manDownDisabled, tagsIconPath + 'man_down_disbled_24.png', tagLocation));
        //     }
        //     if (tag.man_down_tacitated) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.manDownTacitated, lang.manDownTacitated, tagsIconPath + 'man_down_tacitated_24.png', tagLocation));
        //     }
        //     if (tag.man_in_quote) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.manInQuote, lang.manInQuote, tagsIconPath + 'man_in_quote_24.png', tagLocation));
        //     }
        //     if (tag.call_me_alarm) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.callMeAllarm, lang.callMeAllarm, tagsIconPath + 'call_me_alarm_24.png', tagLocation));
        //     }
        //     if (tag.inside_zone) {
        //         alarms.push(home_service.createAlarmObjectForInfoWindow(tag, lang.insideZone, lang.inside_zone, tagsIconPath + 'inside_zone_24.png', tagLocation));
        //     }
        //
        //     return alarms;
        // };
        //
        // /**
        //  * Helper function that create an alarm object with all the parameters to be shown in the alarm window
        //  * @param tag
        //  * @param name
        //  * @param description
        //  * @param image
        //  * @param location
        //  * @returns {{image: *, tagId: *, name: *, description: *, location: *, tag: *}}
        //  */
        // home_service.createAlarmObjectForInfoWindow = (tag, name, description, image, location) => {
        //     return {
        //         tagId      : tag.id,
        //         tag        : tag.name,
        //         name       : name,
        //         description: description,
        //         image      : image,
        //         location: location
        //     };
        // };

        /**
         * Function that control if the tag passed as parameter is outdoor
         * @param tag
         * @returns {boolean|boolean}
         */
        home_service.isOutdoor = (tag) => {
            return tag.gps_north_degree !== 0 && tag.gps_east_degree !== 0;
        };
    }
})();