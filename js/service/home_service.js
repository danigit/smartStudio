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

            let alarmsString = '<div class="margin-top-10-px padding-10-px border-1-top-red ">';

            // getting tags alarms
            locationTags.forEach(t => {
                let alarms = dataService.loadTagAlarmsForInfoWindow(t, '');
                alarms.forEach(a => {
                    alarmsString += '<div class="display-flex margin-bottom-10-px"><div>' +
                        '<img src="' + a.image + '"class="width-55px margin-right-10-px" alt="' + a.name + '"/>' +
                        '</div>' +
                        '<div>' +
                        '   <h3 class="margin-none">' + a.tag + '</h3>' +
                        '   <h4 class="margin-none">' + a.name + '</h4>' +
                        '</div></div>'
                });
            });

            locationAnchors.forEach(a => {
                if (a.battery_status) {
                    alarmsString += '<div class="display-flex margin-bottom-10-px"><div>' +
                        '<img src="img/icons/anchor_battery_empty_24.png"class="width-40px margin-right-25-px" alt="' + a.name + '"/>' +
                        '</div>' +
                        '<div>' +
                        '   <h3 class="margin-none">' + a.name + '</h3>' +
                        '   <h4 class="margin-none">' + lang.batteryEmpty + '</h4>' +
                        '</div></div>'
                }
            });

            alarmsString += '</div>';
            // creating the content of the window
            return new google.maps.InfoWindow({
                content: '<div class="marker-info-container">' +
                    '<div class="infinite-rotation"><img src="' + markersIconPath + marker.icon + '" class="tag-info-icon" alt="Smart Studio" title="Smart Studio"></div>' +
                    '<p class="text-center font-large text-bold color-darkcyan">' + marker.name.toUpperCase() + '</p>' +
                    '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + marker.position[0] + '</b></p></div>' +
                    '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + marker.position[1] + '</b></p></div>' +
                    '<div class="clear-float display-flex"><div class="width-50 margin-left-10-px"><img src="' + iconsPath + 'offline_tags_alert_32.png" class="margin-right-5-px"><span class="font-large vertical-align-super color-red"><b>' + locationTags.length + '</b></span>' +
                    '</div><div class="width-45 "><img src="' + iconsPath + 'offline_anchors_alert_32.png" class="margin-right-10-px"><span class="font-large vertical-align-super color-red"><b>' + locationAnchors.length + '</b></span></div></div>' +
                    alarmsString + '</div>'
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

            let alarmsString = '<div class="margin-top-10-px padding-10-px border-1-top-red">';

            // getting tags alarms
            locationTags.forEach(t => {
                let alarms = dataService.loadTagAlarmsForInfoWindow(t, '');
                alarms.forEach(a => {
                    alarmsString += '<div class="display-flex margin-bottom-10-px"><div>' +
                        '<img src="' + a.image + '"class="width-55px margin-right-10-px" alt="' + a.name + '"/>' +
                        '</div>' +
                        '<div>' +
                        '   <h3 class="margin-none">' + a.tag + '</h3>' +
                        '   <h4 class="margin-none">' + a.name + '</h4>' +
                        '</div></div>'
                });
            });

            alarmsString += '</div>';

            // filling the info window
            return new google.maps.InfoWindow({
                content: '<div class="marker-info-container">' +
                    '<div class="infinite-rotation"><img src="' + markersIconPath + marker.icon + '" class="tag-info-icon" alt="Smart Studio" title="Smart Studio"></div>' +
                    '<p class="text-center font-large text-bold color-darkcyan">' + marker.name.toUpperCase() + '</p>' +
                    '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + marker.position[0] + '</b></p></div>' +
                    '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + marker.position[1] + '</b></p></div>' +
                    '<div class="clear-float display-flex"><div class="margin-auto"><img src="' + iconsPath + 'offline_tags_alert_32.png" class="margin-right-5-px"><span class="font-large vertical-align-super color-red"><b>' + locationTags.length + '</b></span>' +
                    '</div></div>' +
                    alarmsString + '</div>'
            });
        };

        /**
         * Function that create the info windoe for the cluster
         * @param cluster
         * @param markers
         * @param allTags
         * @param userTags
         * @param userAnchors
         */
        home_service.fillInfoWindowCluster = (cluster, markers, allTags, userTags, userAnchors) => {

            let locationTags    = [];
            let locationAnchors = [];
            let clusterString   = '<div class="margin-top-10-px"><md-list>';
            let clusterAlarmsString = '';

            cluster.markers_.forEach(m => {
                markers.forEach((l, idx) => {
                    listState.push(l.name);
                    // getting the current marker tags
                    if (l.is_inside) {
                        locationTags    = home_service.getIndoorLocationTags(l, userTags);
                        locationAnchors = home_service.getLocationAnchors(l, userAnchors);
                    } else {
                        //getting the current marker anchors
                        locationTags = home_service.getOutdoorLocationTags(l, allTags);
                    }

                    if (m.getPosition().lat() === l.position[0] && m.getPosition().lng() === l.position[1]) {
                        clusterString += '<div>' +
                            '<div onclick="displayListCluster(listState[' + idx + '], ' + idx + ')" class="cursor-pointer outline-none padding-top-bottom-6px">' +
                            '<p class="text-center text-bold color-darkcyan">' + l.name +
                            '<span><img class="position-absolute right-20-px" src="img/icons/open-list-icon.ico"></span></p>' +
                            '</div>' +
                            '<md-list id="' + l.name + '_id" style="display: none">' +
                            '<md-list-item class="">' +
                            '<p class="float-left text-bold">' + lang.tags + ':</p>' +
                            '<p class="float-right text-right">' + locationTags.length + '</p>' +
                            '</md-list-item>' +
                            '<md-list-item>' +
                            '<p class="float-right text-bold">' + lang.latitude + '</p>' +
                            '<p class="float-left text-right">' + l.position[0] + '</p>' +
                            '</md-list-item>' +
                            '<md-list-item>' +
                            '<p class="float-left text-bold">' + lang.longitude + '</p>' +
                            '<p class="float-right text-right">' + l.position[1] + '</p>' +
                            '</md-list-item>';
                        if (l.is_inside) {
                            clusterString += '<md-list-item class="" ng-if="l.is_inside">' +
                                '<p class="float-left text-bold">' + lang.anchors + ':</p>' +
                                '<p class="float-right text-right">' + locationAnchors.length + '</p>' +
                                '</md-list-item>'
                        }

                        // clusterString += '<md-button ' +
                        //         'onclick="loadLocation(locationTagsCluster[' + idx + '])" ' +
                        //         'class="md-raised background-gray color-darkcyan margin-top-5-px">' + lang.openSite +
                        // '</md-button>';

                        clusterString += '</md-list></div>'
                    }
                })
            });

            clusterString += '</md-list>'
            clusterAlarmsString = '<div class="margin-top-20-px max-height-135px overflow-auto padding-top-15-px border-1-top-red">';

            cluster.markers_.forEach(m => {
                markers.forEach(l => {
                    let locationTags = [];

                    if (l.is_inside) {
                        locationTags = home_service.getIndoorLocationTags(l, userTags);
                    } else {
                        locationTags = home_service.getOutdoorLocationTags(l, allTags);
                    }

                    if (m.getPosition().lat() === l.position[0] && m.getPosition().lng() === l.position[1]) {
                        // getting tags alarms
                        locationTags.forEach(t => {

                            let alarms = dataService.loadTagAlarmsForInfoWindow(t, '');
                            if (alarms.length > 0){

                                alarms.forEach(a => {
                                    clusterAlarmsString += '<div class="display-flex margin-bottom-10-px"><div>' +
                                        '<img src="' + a.image + '"class="width-55px margin-right-10-px" alt="' + a.name + '"/>' +
                                        '</div>' +
                                        '<div>' +
                                        '   <h3 class="margin-none">' + a.tag + ' - ' + l.name + '</h3>' +
                                        '   <h4 class="margin-none">' + a.name + '</h4>' +
                                        '</div></div>'
                                });
                            } 
                        });
                    }
                });
            });

            clusterString += clusterAlarmsString;
            clusterString += '</div></div>';

            // filling the info window
            return new google.maps.InfoWindow({
                content: angular.element('<div class="marker-info-container">' +
                    '<div class="width-100 text-center"><h2>' + lang.locations + '</h2></div>' +
                    clusterString + '</div>')[0]
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
            // return anchors.some(a => a.is_offline || a.battery_status);
            // I put this because mentarly the anchors don't have to generate alarms
            return false;
        };
    

        /**
         * Function that controls if the offline anchors icon has to be shownd 
         * @param {Array} anchors 
         */
        home_service.checkIfOfflineAnchorsIconHasToBeShown = (anchors) => {

            return anchors.some(a => a.is_offline || a.battery_status);
        }

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
         * Function that control if the marker has the same position of the markerObject
         * @param marker
         * @param markerObject
         * @returns {boolean|boolean}
         */
        home_service.isMarkerSelected = (marker, markerObject) => {
            return marker.getPosition().lat() === markerObject.getPosition().lat() && marker.getPosition().lng() === markerObject.getPosition().lng()
        };

        /**
         * Function that set the alarm icon to the cluster if there is a location in alarm inside
         * @param clusterLocations
         */
        home_service.hasClusterAlarms = (clusterLocations) => {
            return clusterLocations.some(cl => {
                if (!cl.is_inside) {
                    let tags = home_service.getOutdoorLocationTags(cl, dataService.allTags.filter(t => !t.radio_switched_off));
                    return dataService.checkIfTagsHaveAlarms(tags)
                } else{
                    let tags = home_service.getIndoorLocationTags(cl, dataService.userTags.filter(t => !t.radio_switched_off));
                    return dataService.checkIfTagsHaveAlarms(tags)
                }
            })
        }
    }
})();