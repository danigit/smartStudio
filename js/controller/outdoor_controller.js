(function() {
    'use strict';

    angular.module('main').controller('outdoorController', outdoorController);

    /**
     * Function that manages the outdoor locations includind:
     * * tag position
     * * tag alarms
     * * location radius
     * * location areas
     * @type {string[]}
     */
    outdoorController.$inject = ['$scope', '$rootScope', '$state', '$interval', '$mdDialog', '$timeout', 'NgMap', 'dataService', 'newSocketService', 'outdoorService'];

    function outdoorController($scope, $rootScope, $state, $interval, $mdDialog, $timeout, NgMap, dataService, newSocketService, outdoorService) {
        let outdoorCtrl = this;
        let tags = null;
        let bounds = new google.maps.LatLngBounds();
        let locationInfo = dataService.location;
        let outdoorMap = null;
        let insideCircleInfoWindow = null;
        let outsideCircleInfoWindow = null;
        let outdoorTags = [];

        outdoorCtrl.ctrlDataService = dataService.playAlarm;
        outdoorCtrl.locationName = dataService.location.name;
        outdoorCtrl.socketOpened = socketOpened;

        dataService.drawingManagerRect = new google.maps.drawing.DrawingManager({
            drawingMode: google.maps.drawing.OverlayType.RECTANGLE,
        });

        dataService.drawingManagerRound = new google.maps.drawing.DrawingManager({
            drawingMode: google.maps.drawing.OverlayType.CIRCLE,
        });

        dataService.updateMapTimer = null;
        dataService.dynamicTags = [];

        outdoorCtrl.isAdmin = dataService.isAdmin;
        outdoorCtrl.isUserManager = dataService.isUserManager;
        outdoorCtrl.isTracker = dataService.isTracker;

        outdoorCtrl.mapConfiguration = {
            zoom: OUTDOOR_LOCATION_ZOOM,
            map_type: mapType,
            center: mapCenter
        };

        dataService.loadUserSettings();

        /**
         * Function that show the info window with the online/offline tags
         */
        outdoorCtrl.showOfflineTags = () => {
            dataService.updateMapTimer = dataService.stopTimer(dataService.updateMapTimer);
            dataService.showOfflineTags('outdoor', constantUpdateMapTags, outdoorMap);
        };

        /**
         * Function that show the info window with the online/offline anchors
         */
        outdoorCtrl.showOfflineAnchors = () => {
            // stopping the home interval
            dataService.updateMapTimer = dataService.stopTimer(dataService.updateMapTimer);
            dataService.showOfflineAnchors('outdoor', constantUpdateMapTags, outdoorMap);
        };

        /**
         * Function that show the info window with all the alarms
         */
        outdoorCtrl.showAlarms = () => {
            // stoping the map timer
            dataService.updateMapTimer = dataService.stopTimer(dataService.updateMapTimer);

            //showing the alarm table
            dataService.showAlarms(constantUpdateMapTags, outdoorMap, 'outdoor');
        };

        /**
         * Function that shows a GoogleMaps InfoWindow with the coordinates where the click event passed as parameter happened
         * @param map
         * @param event
         */
        let showCoordinatesOnClick = (map, event) => {
            if (outsideCircleInfoWindow !== null) {
                outsideCircleInfoWindow.close();
                if (insideCircleInfoWindow !== null) {
                    insideCircleInfoWindow.close();
                }
            }

            outsideCircleInfoWindow = new google.maps.InfoWindow({
                content: '<div class="marker-info-container">' +
                    '<img src="' + iconsPath + 'login-icon.png" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
                    '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + event.latLng.lat() + '</b></p></div>' +
                    '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + event.latLng.lng() + '</b></p></div>' +
                    '</div>'
            });

            outsideCircleInfoWindow.open(map);
            outsideCircleInfoWindow.setPosition(event.latLng);
        };

        // getting the map variable
        NgMap.getMap('outdoor-map', { timeout: 20000 }).then((map) => {
            outdoorMap = map;

            // setting the map style
            map.set('styles', MAP_CONFIGURATION);
            map.setZoom(OUTDOOR_LOCATION_ZOOM);

            //showing the info with the coordinates when I click on the map
            google.maps.event.addListener(map, 'click', (event) => {
                showCoordinatesOnClick(map, event, outsideCircleInfoWindow, insideCircleInfoWindow)
            });

            // updating every second the map
            constantUpdateMapTags(map, true);

        });

        /**
         * Function that updates every n seconds the elements on the map
         * @param map
         * @param updateZones
         */
        let constantUpdateMapTags = (map, updateZones) => {
            let tagAlarms = [];
            let alarmsCounts = [];
            let prevAlarmCounts = [];

            // this is the marker corresponding to the tag I am working with
            let mapMarker = null;

            // drawing the circle that defines the location area
            let circle = new google.maps.Circle({
                strokeColor: '#0093c4',
                strokeOpacity: CIRCLE_STROKE_OPACITY,
                strokeWeight: CIRCLE_WEIGHT,
                fillColor: '#0093c4',
                fillOpacity: CIRCLE_OPACITY,
                map: map,
                center: new google.maps.LatLng(locationInfo.latitude, locationInfo.longitude),
                radius: locationInfo.meter_radius,
            });

            //showing the info window with the coordinates when I click inside the circle
            circle.addListener('click', function(event) {
                showCoordinatesOnClick(map, event)
            });

            // controlling if I have to update the zones
            if (updateZones) {
                newSocketService.getData('get_outdoor_zones', { location: dataService.location.name }, (response) => {

                    //updating the forbidden zones position
                    response.result.forEach(zone => {
                        // control if the zone to be drowned is a circle or a rectangle
                        if (zone.gps_north === null && zone.gps_east === null && zone.radius === null) {
                            // drawing the rectangle
                            dataService.outdoorZones.push({
                                id: zone.id,
                                zone: new google.maps.Rectangle({
                                    strokeColor: zone.color,
                                    strokeOpacity: CIRCLE_STROKE_OPACITY,
                                    strokeWeight: CIRCLE_WEIGHT,
                                    fillColor: zone.color,
                                    fillOpacity: RECTANGLE_ZONE_OPACITY,
                                    map: map,
                                    bounds: {
                                        north: zone.x_left,
                                        south: zone.x_right,
                                        east: zone.y_up,
                                        west: zone.y_down
                                    }
                                })
                            });
                        }
                        // the zone is a circle
                        else {
                            dataService.outdoorZones.push({
                                id: zone.id,
                                zone: new google.maps.Circle({
                                    strokeColor: zone.color,
                                    strokeOpacity: CIRCLE_STROKE_OPACITY,
                                    strokeWeight: CIRCLE_WEIGHT,
                                    fillColor: zone.color,
                                    fillOpacity: CIRCLE_ZONE_OPACITY,
                                    map: map,
                                    center: {
                                        lat: parseFloat(zone.gps_north),
                                        lng: parseFloat(zone.gps_east)
                                    },
                                    radius: zone.radius * 111000
                                })
                            });
                        }
                    });
                });
            }

            // updating the elements on the map every n seconds
            dataService.updateMapTimer = $interval(() => {

                if (DEBUG)
                    console.log('outdoor map updating...');

                // controlling if the socket is opened
                outdoorCtrl.socketOpened = socketOpened;

                // getting all the tags
                newSocketService.getData('get_all_tags', {}, (response) => {
                    dataService.allTags = response.result;

                    tags = response.result.filter(t => !t.radio_switched_off);
                    // getting all the locations
                    newSocketService.getData('get_all_locations', {}, (locations) => {
                        newSocketService.getData('get_tags_by_user', { user: dataService.user.username }, (userTags) => {
                            let outdoorTags = response.result.filter(t => dataService.isOutdoor(t));
                            let alarmTags = [...outdoorTags, ...userTags.result]

                            // showing the alarm icon if there are tags out of location and the quick action is setted
                            // showing the alarm icon if there are tags with alarms
                            outdoorCtrl.showAlarmsIcon = alarmTags.some(t => dataService.haveToShowBatteryEmpty(t)) && 
                            (dataService.showAlarmForOutOfLocationTags(tags.filter(t => dataService.isOutdoor(t)), locations.result.filter(l => !l.is_inside)) ||
                                dataService.checkIfTagsHaveAlarmsInfo(tags));

                            // showing tags alarm icon if there are tags offline
                            outdoorCtrl.showOfflineTagsIcon = dataService.checkIfTagsAreOffline(alarmTags);
                        });

                        // playing the audio if there are alarms
                        dataService.playAlarmsAudio(tags);

                        // gettin only the outdoor tags that have not superated the second delta
                        outdoorTags = response.result.filter(t => dataService.isOutdoor(t) && dataService.hasTagAValidGps(t) && !dataService.hasTagSuperatedSecondDelta(t));

                        dataService.dynamicTags.filter(marker => !outdoorService.isMarkerStillOnMap(marker, outdoorTags))
                            .forEach(dt => {
                                dataService.dynamicTags.forEach((tag, index) => {
                                    if (dataService.dynamicTags[index].getPosition().equals(dt.getPosition())) {
                                        dataService.dynamicTags[index].setMap(null);
                                        dataService.dynamicTags.splice(index, 1);
                                    }
                                })
                            });

                        // handling the drawing of the markers on the outdoor location
                        outdoorTags.forEach((tag, index) => {
                            alarmsCounts.push(0);
                            prevAlarmCounts.push(0);

                            // controlling if the tag is in the location
                            if (dataService.isTagInLocation(tag, { radius: locationInfo.radius, position: [locationInfo.latitude, locationInfo.longitude] })) {

                                // getting the alarms of the tag
                                tagAlarms = dataService.getTagAlarms(tag);

                                // creating the marker corresponding to the tag
                                let marker = new google.maps.Marker({
                                    position: new google.maps.LatLng(tag.gps_north_degree, tag.gps_east_degree),
                                });

                                // adding the window with the information's of the tag, to the marker when I click on it
                                setMarkerInfoWindow(marker, tag, locationInfo.name);

                                // getting the index of the marker on the map that has the same position as the tag
                                mapMarker = outdoorService.markerIsOnMap(dataService.dynamicTags, marker);

                                //controlling if the tag is online and if has to be shown (not turned off), if yes I show the tags on the map
                                //TODO - put the server time that I get when  I get all the tags
                                if (!tag.radio_switched_off && (new Date(tag.now_time) - (new Date(tag.gps_time)) < tag.sleep_time_outdoor) ) {
                                    // setting the icon of the created marker
                                    outdoorService.setIcon(tag, marker, false);

                                    // If the user is admin I show all the tags
                                    if (outdoorCtrl.isAdmin || outdoorCtrl.isTracker) {
                                        // showing the tag on the map
                                        setOutdoorMarker(mapMarker, marker, tag, alarmsCounts, index, tagAlarms, prevAlarmCounts, map, true, locationInfo.name);
                                    }
                                    // controlling if the user is user manager and if i have to show the green tags
                                    else if (outdoorCtrl.isUserManager && dataService.switch.showOutdoorTags) {
                                        // if there is at most a tag with alarm then I show all the tags on the map
                                        if (dataService.checkIfTagsHaveAlarmsOutdoor(tags)) {
                                            // showing the tag on the map
                                            setOutdoorMarker(mapMarker, marker, tag, alarmsCounts, index, tagAlarms, prevAlarmCounts, map, true, locationInfo.name);
                                        }
                                        // if there are no tags with alarms then I don't show anything
                                        else if(dataService.dynamicTags[mapMarker] !== undefine){
                                            dataService.dynamicTags[mapMarker].setMap(null);
                                            dataService.dynamicTags.splice(mapMarker, 1);
                                        }
                                    }
                                    else if (!(outdoorCtrl.isAdmin && outdoorCtrl.isTracker && outdoorCtrl.isUserManager)){
                                        if (dataService.checkIfTagHasAlarmNoBattery(tag)) {
                                            // showing the tag on the map
                                            setOutdoorMarker(mapMarker, marker, tag, alarmsCounts, index, tagAlarms, prevAlarmCounts, map, true, locationInfo.name);
                                        }
                                         // if there are no tags with alarms then I don't show anything
                                        else if (dataService.dynamicTags[mapMarker] !== undefine){
                                            dataService.dynamicTags[mapMarker].setMap(null);
                                            dataService.dynamicTags.splice(mapMarker, 1);
                                        }
                                    }
                                }
                                // controlling if the tag is not turned off
                                else if (!tag.radio_switched_off) {
                                    // setting the icon of the created marker
                                    outdoorService.setIcon(tag, marker, true);

                                    // control if the user is admin or tracker
                                    if (outdoorCtrl.isAdmin || outdoorCtrl.isTracker) {
                                        setOutdoorMarker(mapMarker, marker, tag, alarmsCounts, index, tagAlarms, prevAlarmCounts, map, false, locationInfo.name);
                                    } else if (outdoorCtrl.isUserManager && dataService.switch.showOutdoorTags) {
                                        if (dataService.checkIfTagsHaveAlarmsOutdoor(tags)) {
                                            setOutdoorMarker(mapMarker, marker, tag, alarmsCounts, index, tagAlarms, prevAlarmCounts, map, false, locationInfo.name);
                                        } else {
                                            if (dataService.dynamicTags[mapMarker] !== undefine) {
                                                dataService.dynamicTags[mapMarker].setMap(null);
                                                dataService.dynamicTags.splice(mapMarker, 1);   
                                            }
                                        }
                                    }
                                    else if (!(outdoorCtrl.isAdmin && outdoorCtrl.isTracker && outdoorCtrl.isUserManager)){
                                        if (dataService.checkIfTagHasAlarmNoBattery(tag)) {
                                            // showing the tag on the map
                                            setOutdoorMarker(mapMarker, marker, tag, alarmsCounts, index, tagAlarms, prevAlarmCounts, map, true, locationInfo.name);
                                        }
                                         // if there are no tags with alarms then I don't show anything
                                        else if(dataService.dynamicTags[mapMarker] !== undefined) {
                                            dataService.dynamicTags[mapMarker].setMap(null);
                                            dataService.dynamicTags.splice(mapMarker, 1);
                                        }
                                    }
                                }
                                // removing all the tags from the map
                                else if (dataService.dynamicTags[mapMarker] !== undefined) {
                                    dataService.dynamicTags[mapMarker].setMap(null);
                                    dataService.dynamicTags.splice(mapMarker, 1);
                                }

                                prevAlarmCounts[index] = tagAlarms.length;
                            }
                        });

                        // Setting automatically the center of the map
                        // TODO - have to set the center only when I add or remove a new tag
                        if (dataService.dynamicTags.length === 1) {
                            // map.setCenter(bounds.getCenter());
                        } else if (dataService.dynamicTags.length > 1) {
                            // map.setCenter(bounds.getCenter());
                        } else {
                            // let latLng = new google.maps.LatLng(dataService.location.latitude, dataService.location.longitude);
                            // map.setCenter(latLng);
                        }
                    });
                });

                // showing or not the alarm anchors icon
                newSocketService.getData('get_anchors_by_user', { user: dataService.user.username }, (response) => {
                    outdoorCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(response.result);
                });

                // showing or not the engine icon
                newSocketService.getData('get_engine_on', {}, (response) => {
                    if (response.result.version != undefined)
                        dataService.controlVersion(response.result.version)
                    outdoorCtrl.showEngineOffIcon = response.result.time_le === undefined;
                });
            }, OUTDOOR_ALARM_UPDATE_TIME);

            // TODO - i don't think this is needed
            let latLng = new google.maps.LatLng(dataService.location.latitude, dataService.location.longitude);
            map.setCenter(latLng);
        };

        /**
         * Function that put the marker on the map if it has to be shown, or remove it if it has to be removed
         * @param mapMarker
         * @param marker
         * @param tag
         * @param alarmsCounts
         * @param index
         * @param tagAlarms
         * @param prevAlarmCounts
         * @param map
         * @param online
         * @param locationName
         */
        let setOutdoorMarker = (mapMarker, marker, tag, alarmsCounts, index, tagAlarms, prevAlarmCounts, map, online, locationName) => {
            // control if the marker is on map
            if (mapMarker !== -1) {
                // reseting the info window after the marker is changed
                google.maps.event.clearListeners(dataService.dynamicTags[mapMarker], 'click');
                setMarkerInfoWindow(dataService.dynamicTags[mapMarker], tag, locationName);

                // control if the tag has alarms so that I show the alarm tag
                if (dataService.checkIfTagHasAlarmNoBattery(tag)) {

                    // resetting the alarm alternation
                    if (alarmsCounts[index] > tagAlarms.length - 1) {
                        alarmsCounts[index] = 0;
                    }

                    // setting the icon of the marker on the map
                    dataService.dynamicTags[mapMarker].setIcon(tagAlarms[alarmsCounts[index]++]);
                }
                // removing the tag from the map if is turned off
                else {
                    // control if the tag is online or offline
                    if (tag.battery_status && !dataService.hasTagReaperedAfterOffline(tag)) {
                        dataService.dynamicTags[mapMarker].setIcon(tagsIconPath + 'battery_low_24.png');
                    } else if (online) {
                        dataService.setMarkerOnlineIcon(dataService.dynamicTags[mapMarker]);
                    } else {
                        dataService.setMarkerOfflineIcon(dataService.dynamicTags[mapMarker])
                    }
                }
            } else {
                dataService.dynamicTags.push(marker);
                marker.setMap(map);
                bounds.extend(marker.getPosition());
            }
        };

        /**
         * Function that sets the marker InforWindow
         * @param marker
         * @param tag
         * @param locationName
         */
        let setMarkerInfoWindow = (marker, tag, locationName) => {
            marker.addListener('click', () => {
                $mdDialog.show({
                    locals: { tag: tag },
                    templateUrl: componentsPath + 'tag-info-outdoor.html',
                    parent: angular.element(document.body),
                    targetEvent: event,
                    clickOutsideToClose: true,
                    controller: ['$scope', 'tag', ($scope, tag) => {
                        $scope.tag = tag;
                        $scope.isTagInAlarm = 'background-red';
                        $scope.alarms = [];

                        $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, locationName);

                        if ($scope.alarms.length === 0) {
                            (dataService.isTagOffline(tag)) ?
                            $scope.isTagInAlarm = 'background-darkgray': $scope.isTagInAlarm = 'background-green';
                        }

                        $scope.hide = () => {
                            $mdDialog.hide();
                        }
                    }]
                })
            });
        };

        /**
         * Function that center the map
         */
        $scope.centerMap = () => {
            let latLng = new google.maps.LatLng(dataService.location.latitude, dataService.location.longitude);
            outdoorMap.setCenter(latLng);
        };

        $rootScope.$on('constantUpdateMapTags', function(event, map) {
            constantUpdateMapTags(map);
        });

        /**
         * Function that takes you to the home page
         */
        outdoorCtrl.goHome = () => {
            dataService.goHome();
        };

        //releasing the resources on page destroy
        $scope.$on('$destroy', () => {
            $mdDialog.hide();
            dataService.updateMapTimer = dataService.stopTimer(dataService.updateMapTimer);
            bounds = new google.maps.LatLngBounds(null);
        })
    }
})();