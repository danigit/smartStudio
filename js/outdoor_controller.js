(function(){
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
        let outdoorCtrl                = this;
        let tags                       = null;
        let bounds                     = new google.maps.LatLngBounds();
        let locationInfo               = dataService.location;
        let controllerMap              = null;
        let insideCircleInfoWindow = null;
        let outsideCircleInfoWindow = null;
        let outdoorTags = [];
        outdoorCtrl.ctrlDataService = dataService.playAlarm;

        dataService.drawingManagerRect = new google.maps.drawing.DrawingManager({
            drawingMode: google.maps.drawing.OverlayType.RECTANGLE,
        });

        dataService.drawingManagerRound = new google.maps.drawing.DrawingManager({
            drawingMode: google.maps.drawing.OverlayType.CIRCLE,
        });

        dataService.updateMapTimer = null;
        dataService.dynamicTags    = [];

        outdoorCtrl.isAdmin = dataService.isAdmin;
        outdoorCtrl.isUserManager = dataService.isUserManager;
        outdoorCtrl.isTracker = dataService.isTracker;

        outdoorCtrl.mapConfiguration = {
            zoom    : outdoorLocationZoom,
            map_type: mapType,
            center  : mapCenter
        };

        dataService.loadUserSettings();

        //showing the info window with the online/offline tags
        outdoorCtrl.showOfflineTags = () => {
            dataService.updateMapTimer = dataService.stopTimer(dataService.updateMapTimer);
            dataService.showOfflineTags('outdoor', constantUpdateMapTags, controllerMap);
        };

        //showing the info window with all the alarms
        outdoorCtrl.showAlarms = () => {
            // stoping the map timer
            dataService.updateMapTimer = dataService.stopTimer(dataService.updateMapTimer);

            //showing the alarm table
            dataService.showAlarms(constantUpdateMapTags, controllerMap);
        };

        /**
         * Function that shows a GoogleMaps InfoWindow with the coordinates where the click event passed as parameter happened
         * @param map
         * @param event
         */
        let showCoordinatesOnClick = (map, event) => {
            if (outsideCircleInfoWindow !== null) {
                outsideCircleInfoWindow.close();
                if (insideCircleInfoWindow !== null){
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
        NgMap.getMap('outdoor-map').then((map) => {
            controllerMap = map;

            // setting the map style
            map.set('styles', mapConfiguration);
            map.setZoom(outdoorLocationZoom);

            //showing the info with the coordinates when I click on the map
            google.maps.event.addListener(map, 'click', (event) => {
                showCoordinatesOnClick(map, event, outsideCircleInfoWindow, insideCircleInfoWindow)
            });

            // updating every second the map
            constantUpdateMapTags(map, true);

        });

        //updating the markers of the map every second
        /**
         * Function that updates every n seconds the elements on the map
         * @param map
         * @param updateZones
         */
        let constantUpdateMapTags = (map, updateZones) => {
            let tagAlarms       = [];
            let localTags       = [];
            let alarmsCounts    = new Array(100).fill(0);
            let prevAlarmCounts = new Array(100).fill(0);

            // this is the marker corresponding to the tag I am working with
            let mapMarker = null;

            // drawing the circle that delines the location area
            let circle = new google.maps.Circle({
                strokeColor  : '#0093c4',
                strokeOpacity: CIRCLE_STROKE_OPACITY,
                strokeWeight : CIRCLE_WEIGHT,
                fillColor    : '#0093c4',
                fillOpacity  : CIRCLE_OPACITY,
                map          : map,
                center       : new google.maps.LatLng(locationInfo.latitude, locationInfo.longitude),
                radius       : locationInfo.meter_radius,
            });

            //showing the info window with the coordinates when I click inside the circle
            circle.addListener('click', function (event) {
                showCoordinatesOnClick(map, event)
            });

            // controlling if I have to update the zones
            if (updateZones) {
                newSocketService.getData('get_outdoor_zones', {location: dataService.location.name}, (response) => {
                    if (!response.session_state)
                        window.location.reload();

                    //updating the forbidden zones position
                    response.result.forEach(zone => {
                        // control if the zone to be drowned is a circle or a rectangle
                        if (zone.gps_north === null && zone.gps_east === null && zone.radius === null) {
                            // drawing the rectangle
                            dataService.outdoorZones.push({
                                id: zone.id,
                                zone: new google.maps.Rectangle({
                                    strokeColor  : zone.color,
                                    strokeOpacity: CIRCLE_STROKE_OPACITY,
                                    strokeWeight : CIRCLE_WEIGHT,
                                    fillColor    : zone.color,
                                    fillOpacity  : RECTANGLE_ZONE_OPACITY,
                                    map          : map,
                                    bounds       : {
                                        north: zone.x_left,
                                        south: zone.x_right,
                                        east : zone.y_up,
                                        west : zone.y_down
                                    }
                                })
                            });
                        } else {
                            // drawing the circle
                            dataService.outdoorZones.push({
                                id: zone.id,
                                zone: new google.maps.Circle({
                                    strokeColor  : zone.color,
                                    strokeOpacity: CIRCLE_STROKE_OPACITY,
                                    strokeWeight : CIRCLE_WEIGHT,
                                    fillColor    : zone.color,
                                    fillOpacity  : CIRCLE_ZONE_OPACITY,
                                    map          : map,
                                    center       : {
                                        lat: parseFloat(zone.gps_north),
                                        lng: parseFloat(zone.gps_east)
                                    },
                                    radius       : zone.radius * 111000
                                })
                            });
                        }
                    });
                });
            }

            // updating the elements on the map every n seconds
            dataService.updateMapTimer = $interval(() => {

                // getting all the tags
                newSocketService.getData('get_all_tags', {}, (response) => {
                    dataService.allTags = response.result;

                    tags = response.result;
                    // getting all the locations
                    newSocketService.getData('get_all_locations', {}, (locations) => {

                        // showing the alarm icon if there are tags out of location and the quick action is setted
                        outdoorCtrl.showAlarmsIcon = dataService.showAlarmForOutOfLocationTags(tags, locations.result);

                        // showing the alarm icon if there are tags with alarms
                        outdoorCtrl.showAlarmsIcon      = dataService.checkIfTagsHaveAlarmsInfo(response.result);

                        // showing tags alarm icon if there are tags offline
                        outdoorCtrl.showOfflineTagsIcon = dataService.checkIfTagsAreOffline(response.result);

                        // playing the audio if there are alarms
                        dataService.playAlarmsAudio(response.result);

                        // gettin only the outdoor tags
                        outdoorTags = response.result.filter(t => dataService.isOutdoor(t) && dataService.hasTagAValidGps(t));

                        // deleting markers on the map that have change position
                        dataService.dynamicTags.filter(marker => !outdoorService.isMarkerStillOnMap(marker, outdoorTags))
                            .forEach(dt => {
                                dataService.dynamicTags.forEach((tag, index) => {
                                    if (dataService.dynamicTags[index].getPosition().equals(dt.getPosition())){
                                        dataService.dynamicTags[index].setMap(null);
                                        dataService.dynamicTags.splice(index, 1);
                                    }
                            })
                        });

                        outdoorTags.forEach((tag, index) => {
                            // if (dataService.isOutdoor(tag)) {
                                if (dataService.isTagInLocation(tag, {radius: locationInfo.radius, position: [locationInfo.latitude, locationInfo.longitude]})) {
                                    // console.log(tag);
                                    tagAlarms = dataService.getTagAlarms(tag);

                                    let marker = new google.maps.Marker({
                                        position: new google.maps.LatLng(tag.gps_north_degree, tag.gps_east_degree),
                                    });

                                    //showing the info window of the tag when clicked
                                    marker.addListener('click', () => {
                                        $mdDialog.show({
                                            locals             : {tag: tag},
                                            templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                            parent             : angular.element(document.body),
                                            targetEvent        : event,
                                            clickOutsideToClose: true,
                                            controller         : ['$scope', 'tag', ($scope, tag) => {
                                                $scope.tag          = tag;
                                                $scope.isTagInAlarm = 'background-red';
                                                $scope.alarms       = [];

                                                $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, locationInfo.name);

                                                if ($scope.alarms.length === 0) {
                                                    (!$scope.tag.radio_switched_off)
                                                        ? $scope.isTagInAlarm = 'background-gray'
                                                        : $scope.isTagInAlarm = 'background-green';
                                                }

                                                $scope.hide = () => {
                                                    $mdDialog.hide();
                                                }
                                            }]
                                        })
                                    });


                                    // getting the index of the marker on the map that has the same position as the tag
                                    mapMarker = dataService.markerIsOnMap(dataService.dynamicTags, marker);

                                    // setting the online tag icon to the created marker
                                    outdoorService.setIcon(tag, marker);

                                    //controlling if the tag is online and if has to be shown, if yes I show the tags on the map
                                    //TODO - put the server time that I get when  I get all the tags
                                    if ((new Date(Date.now()) - (new Date(tag.gps_time)) < tag.sleep_time_outdoor)) {

                                        // If the user is admin I show all the tags
                                        if (outdoorCtrl.isAdmin === 1 || outdoorCtrl.isTracker) {
                                            setOutdoorMarker(mapMarker, tag, alarmsCounts, index, tagAlarms, prevAlarmCounts, map);
                                            // if (mapMarker !== -1) {
                                            //     // control if the tag has alarms so that I show the alarm tag
                                            //     if (dataService.checkIfTagHasAlarm(tag)) {
                                            //         // control if the marker corresponding to the tag position is on map
                                            //         // if yes I change the icon of the marker on the map
                                            //
                                            //         if (alarmsCounts[index] > tagAlarms.length - 1) {
                                            //             alarmsCounts[index] = 0;
                                            //         }
                                            //
                                            //         dataService.dynamicTags[mapMarker].setIcon(tagAlarms[alarmsCounts[index]++]);
                                            //
                                            //         if (tagAlarms.length !== prevAlarmCounts[index]) {
                                            //             google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                                            //             dataService.dynamicTags[mapMarker].addListener('click', () => {
                                            //                 $mdDialog.show({
                                            //                     locals             : {tag: tag},
                                            //                     templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                            //                     parent             : angular.element(document.body),
                                            //                     targetEvent        : event,
                                            //                     clickOutsideToClose: true,
                                            //                     controller         : ['$scope', 'tag', ($scope, tag) => {
                                            //                         $scope.tag          = tag;
                                            //                         $scope.isTagInAlarm = 'background-red';
                                            //
                                            //                         $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                                            //
                                            //                         if ($scope.alarms.length === 0) {
                                            //                             (!$scope.tag.radio_switched_off)
                                            //                                 ? $scope.isTagInAlarm = 'background-gray'
                                            //                                 : $scope.isTagInAlarm = 'background-green';
                                            //                         }
                                            //
                                            //                         $scope.hide = () => {
                                            //                             $mdDialog.hide();
                                            //                         }
                                            //                     }]
                                            //                 })
                                            //             })
                                            //         }
                                            //             // dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                            //             //     if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                            //             //         if (alarmsCounts[index] > tagAlarms.length - 1)
                                            //             //             alarmsCounts[index] = 0;
                                            //             //
                                            //             //         dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                                            //             //
                                            //             //         if (tagAlarms.length !== prevAlarmCounts[index]) {
                                            //             //             google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                                            //             //             dataService.dynamicTags[tagIndex].addListener('click', () => {
                                            //             //                 $mdDialog.show({
                                            //             //                     locals             : {tag: tag},
                                            //             //                     templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                            //             //                     parent             : angular.element(document.body),
                                            //             //                     targetEvent        : event,
                                            //             //                     clickOutsideToClose: true,
                                            //             //                     controller         : ['$scope', 'tag', ($scope, tag) => {
                                            //             //                         $scope.tag          = tag;
                                            //             //                         $scope.isTagInAlarm = 'background-red';
                                            //             //
                                            //             //                         $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                                            //             //
                                            //             //                         if ($scope.alarms.length === 0) {
                                            //             //                             ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                                            //             //                                 ? $scope.isTagInAlarm = 'background-gray'
                                            //             //                                 : $scope.isTagInAlarm = 'background-green';
                                            //             //                         }
                                            //             //
                                            //             //                         $scope.hide = () => {
                                            //             //                             $mdDialog.hide();
                                            //             //                         }
                                            //             //                     }]
                                            //             //                 })
                                            //             //             })
                                            //             //         }
                                            //             //     }
                                            //             // });
                                            //     }
                                            //     // controlling if the tag is not off
                                            //     else if (!tag.radio_switched_off) {
                                            //         dataService.setMarkerOnlineIcon(dataService.dynamicTags[mapMarker]);
                                            //     }
                                            //     // removing the tag from the map if is turned off
                                            //     else {
                                            //         dataService.dynamicTags[mapMarker].setMap(null);
                                            //         dataService.dynamicTags.splice(mapMarker, 1);
                                            //     }
                                            // }
                                            // // putting the new marker on the map
                                            // else {
                                            //     dataService.dynamicTags.push(marker);
                                            //     marker.setMap(map);
                                            //     bounds.extend(marker.getPosition());
                                            // }
                                        }
                                        // controlling if the user is user manager and if i have to show the green tags
                                        else if (outdoorCtrl.isUserManager && dataService.switch.showOutdoorTags) {
                                            if (dataService.checkIfTagsHaveAlarmsOutdoor(tags)) {
                                                setOutdoorMarker(mapMarker, tag, alarmsCounts, index, tagAlarms, prevAlarmCounts, map);
                                            } else{
                                                dataService.dynamicTags.forEach(marker => marker.setMap(null));
                                                if (dataService.dynamicTags.length > 0)
                                                    dataService.dynamicTags = [];
                                            }
                                            // if (dataService.checkIfTagsHaveAlarmsOutdoor(tags)) {
                                            //     if (dataService.checkIfTagHasAlarm(tag)) {
                                            //         if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                            //             dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                            //                 if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                            //                     if (alarmsCounts[index] > tagAlarms.length - 1)
                                            //                         alarmsCounts[index] = 0;
                                            //
                                            //                     dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                                            //
                                            //                     if (tagAlarms.length !== prevAlarmCounts[index]) {
                                            //                         google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                                            //                         dataService.dynamicTags[tagIndex].addListener('click', () => {
                                            //                             $mdDialog.show({
                                            //                                 locals             : {tag: tag},
                                            //                                 templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                            //                                 parent             : angular.element(document.body),
                                            //                                 targetEvent        : event,
                                            //                                 clickOutsideToClose: true,
                                            //                                 controller         : ['$scope', 'tag', ($scope, tag) => {
                                            //                                     $scope.tag          = tag;
                                            //                                     $scope.isTagInAlarm = 'background-red';
                                            //
                                            //                                     $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                                            //
                                            //                                     if ($scope.alarms.length === 0) {
                                            //                                         ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                                            //                                             ? $scope.isTagInAlarm = 'background-gray'
                                            //                                             : $scope.isTagInAlarm = 'background-green';
                                            //                                     }
                                            //
                                            //                                     $scope.hide = () => {
                                            //                                         $mdDialog.hide();
                                            //                                     }
                                            //                                 }]
                                            //                             })
                                            //                         })
                                            //                     }
                                            //                 }
                                            //             });
                                            //         } else {
                                            //             dataService.setIcon(tag, marker);
                                            //             dataService.dynamicTags.push(marker);
                                            //             marker.setMap(map);
                                            //             bounds.extend(marker.getPosition());
                                            //         }
                                            //     } else if (!tag.radio_switched_off) {
                                            //         if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                            //             dataService.setIcon(tag, marker);
                                            //             dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                            //                 if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                            //                     dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                                            //                 }
                                            //             });
                                            //         } else {
                                            //             dataService.setIcon(tag, marker);
                                            //             dataService.dynamicTags.push(marker);
                                            //             marker.setMap(map);
                                            //             bounds.extend(marker.getPosition());
                                            //         }
                                            //     } else {
                                            //         dataService.dynamicTags.forEach((tag, index) => {
                                            //             if (tag.getPosition().equals(marker.getPosition())) {
                                            //                 dataService.dynamicTags[index].setMap(null);
                                            //                 dataService.dynamicTags.splice(index, 1);
                                            //             }
                                            //         });
                                            //     }
                                            // } else {
                                            //     dataService.dynamicTags.forEach((tag, index) => {
                                            //         if (tag.getPosition().equals(marker.getPosition())) {
                                            //             dataService.dynamicTags[index].setMap(null);
                                            //             dataService.dynamicTags.splice(index, 1);
                                            //         }
                                            //     });
                                            // }
                                        }
                                        // else if (outdoorCtrl.isTracker) {
                                        //     if (dataService.checkIfTagHasAlarm(tag)) {
                                        //         if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                        //             dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                        //                 if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                        //                     if (alarmsCounts[index] > tagAlarms.length - 1)
                                        //                         alarmsCounts[index] = 0;
                                        //
                                        //                     dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                                        //
                                        //                     if (tagAlarms.length !== prevAlarmCounts[index]) {
                                        //                         google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                                        //                         dataService.dynamicTags[tagIndex].addListener('click', () => {
                                        //                             $mdDialog.show({
                                        //                                 locals             : {tag: tag},
                                        //                                 templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                        //                                 parent             : angular.element(document.body),
                                        //                                 targetEvent        : event,
                                        //                                 clickOutsideToClose: true,
                                        //                                 controller         : ['$scope', 'tag', ($scope, tag) => {
                                        //                                     $scope.tag          = tag;
                                        //                                     $scope.isTagInAlarm = 'background-red';
                                        //
                                        //                                     $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                                        //
                                        //                                     if ($scope.alarms.length === 0) {
                                        //                                         ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                                        //                                             ? $scope.isTagInAlarm = 'background-gray'
                                        //                                             : $scope.isTagInAlarm = 'background-green';
                                        //                                     }
                                        //
                                        //                                     $scope.hide = () => {
                                        //                                         $mdDialog.hide();
                                        //                                     }
                                        //                                 }]
                                        //                             })
                                        //                         })
                                        //                     }
                                        //                 }
                                        //             });
                                        //         } else {
                                        //             dataService.setIcon(tag, marker);
                                        //             dataService.dynamicTags.push(marker);
                                        //             marker.setMap(map);
                                        //             bounds.extend(marker.getPosition());
                                        //         }
                                        //     } else if (!tag.radio_switched_off) {
                                        //         if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                        //             dataService.setIcon(tag, marker);
                                        //             dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                        //                 if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                        //                     dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                                        //                 }
                                        //             });
                                        //         } else {
                                        //             dataService.setIcon(tag, marker);
                                        //             dataService.dynamicTags.push(marker);
                                        //             marker.setMap(map);
                                        //             bounds.extend(marker.getPosition());
                                        //         }
                                        //     } else {
                                        //         dataService.dynamicTags.forEach((tag, index) => {
                                        //             if (tag.getPosition().equals(marker.getPosition())) {
                                        //                 dataService.dynamicTags[index].setMap(null);
                                        //                 dataService.dynamicTags.splice(index, 1);
                                        //             }
                                        //         });
                                        //     }
                                        // }
                                        else {
                                            // if (dataService.checkIfTagHasAlarm(tag)) {
                                            //     if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                            //         dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                            //             if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                            //                 if (alarmsCounts[index] > tagAlarms.length - 1)
                                            //                     alarmsCounts[index] = 0;
                                            //
                                            //                 dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                                            //
                                            //                 if (tagAlarms.length !== prevAlarmCounts[index]) {
                                            //                     google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                                            //                     dataService.dynamicTags[tagIndex].addListener('click', () => {
                                            //                         $mdDialog.show({
                                            //                             locals             : {tag: tag},
                                            //                             templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                            //                             parent             : angular.element(document.body),
                                            //                             targetEvent        : event,
                                            //                             clickOutsideToClose: true,
                                            //                             controller         : ['$scope', 'tag', ($scope, tag) => {
                                            //                                 $scope.tag          = tag;
                                            //                                 $scope.isTagInAlarm = 'background-red';
                                            //
                                            //                                 $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                                            //
                                            //                                 if ($scope.alarms.length === 0) {
                                            //                                     ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                                            //                                         ? $scope.isTagInAlarm = 'background-gray'
                                            //                                         : $scope.isTagInAlarm = 'background-green';
                                            //                                 }
                                            //
                                            //                                 $scope.hide = () => {
                                            //                                     $mdDialog.hide();
                                            //                                 }
                                            //                             }]
                                            //                         })
                                            //                     })
                                            //                 }
                                            //             }
                                            //         });
                                            //     } else {
                                            //         dataService.setIcon(tag, marker);
                                            //         dataService.dynamicTags.push(marker);
                                            //         marker.setMap(map);
                                            //         bounds.extend(marker.getPosition());
                                            //     }
                                            // } else if (!tag.radio_switched_off) {
                                            //     dataService.dynamicTags.forEach((tag, index) => {
                                            //         if (tag.getPosition().equals(marker.getPosition())) {
                                            //             dataService.dynamicTags[index].setMap(null);
                                            //             dataService.dynamicTags.splice(index, 1);
                                            //         }
                                            //     });
                                            // } else {
                                            //     dataService.dynamicTags.forEach((tag, index) => {
                                            //         if (tag.getPosition().equals(marker.getPosition())) {
                                            //             dataService.dynamicTags[index].setMap(null);
                                            //             dataService.dynamicTags.splice(index, 1);
                                            //         }
                                            //     });
                                            // }
                                        }
                                    } else if (!tag.radio_switched_off) {
                                        if (outdoorCtrl.isAdmin) {
                                            if (dataService.checkIfTagHasAlarm(tag)) {
                                                if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                                    dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                                        if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                                            if (alarmsCounts[index] > tagAlarms.length - 1)
                                                                alarmsCounts[index] = 0;

                                                            dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);

                                                            if (tagAlarms.length !== prevAlarmCounts[index]) {
                                                                google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                                                                dataService.dynamicTags[tagIndex].addListener('click', () => {
                                                                    $mdDialog.show({
                                                                        locals             : {tag: tag},
                                                                        templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                                                        parent             : angular.element(document.body),
                                                                        targetEvent        : event,
                                                                        clickOutsideToClose: true,
                                                                        controller         : ['$scope', 'tag', ($scope, tag) => {
                                                                            $scope.tag          = tag;
                                                                            $scope.isTagInAlarm = 'background-red';

                                                                            $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);

                                                                            if ($scope.alarms.length === 0) {
                                                                                ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                                                                                    ? $scope.isTagInAlarm = 'background-gray'
                                                                                    : $scope.isTagInAlarm = 'background-green';
                                                                            }

                                                                            $scope.hide = () => {
                                                                                $mdDialog.hide();
                                                                            }
                                                                        }]
                                                                    })
                                                                })
                                                            }
                                                        }
                                                    });
                                                } else {
                                                    dataService.setIcon(tag, marker);
                                                    dataService.dynamicTags.push(marker);
                                                    marker.setMap(map);
                                                    bounds.extend(marker.getPosition());
                                                }
                                            } else {
                                                if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                                    marker.setIcon(tagsIconPath + 'offline_tag_24.png')
                                                    dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                                        if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                                            dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                                                        }
                                                    });
                                                } else {
                                                    marker.setIcon(tagsIconPath + 'offline_tag_24.png');
                                                    dataService.dynamicTags.push(marker);
                                                    marker.setMap(map);
                                                    bounds.extend(marker.getPosition());
                                                }
                                            }
                                        } else if (outdoorCtrl.isUserManager && dataService.switch.showOutdoorTags) {
                                            if (dataService.checkIfTagsHaveAlarmsOutdoor(tags)) {
                                                if (dataService.checkIfTagHasAlarm(tag)) {
                                                    if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                                        dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                                            if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                                                if (alarmsCounts[index] > tagAlarms.length - 1)
                                                                    alarmsCounts[index] = 0;

                                                                dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);

                                                                if (tagAlarms.length !== prevAlarmCounts[index]) {
                                                                    google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                                                                    dataService.dynamicTags[tagIndex].addListener('click', () => {
                                                                        $mdDialog.show({
                                                                            locals             : {tag: tag},
                                                                            templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                                                            parent             : angular.element(document.body),
                                                                            targetEvent        : event,
                                                                            clickOutsideToClose: true,
                                                                            controller         : ['$scope', 'tag', ($scope, tag) => {
                                                                                $scope.tag          = tag;
                                                                                $scope.isTagInAlarm = 'background-red';

                                                                                $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);

                                                                                if ($scope.alarms.length === 0) {
                                                                                    ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                                                                                        ? $scope.isTagInAlarm = 'background-gray'
                                                                                        : $scope.isTagInAlarm = 'background-green';
                                                                                }

                                                                                $scope.hide = () => {
                                                                                    $mdDialog.hide();
                                                                                }
                                                                            }]
                                                                        })
                                                                    })
                                                                }
                                                            }
                                                        });
                                                    } else {
                                                        dataService.setIcon(tag, marker);
                                                        dataService.dynamicTags.push(marker);
                                                        marker.setMap(map);
                                                        bounds.extend(marker.getPosition());
                                                    }
                                                } else {
                                                    if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                                        marker.setIcon(tagsIconPath + 'offline_tag_24.png')
                                                        dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                                            if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                                                dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                                                            }
                                                        });
                                                    } else {
                                                        marker.setIcon(tagsIconPath + 'offline_tag_24.png')
                                                        dataService.dynamicTags.push(marker);
                                                        marker.setMap(map);
                                                        bounds.extend(marker.getPosition());
                                                    }
                                                }
                                            } else {
                                                dataService.dynamicTags.forEach((tag, index) => {
                                                    if (tag.getPosition().equals(marker.getPosition())) {
                                                        dataService.dynamicTags[index].setMap(null);
                                                        dataService.dynamicTags.splice(index, 1);
                                                    }
                                                });
                                            }
                                        } else if (outdoorCtrl.isTracker) {
                                            console.log('istracker');
                                            if (dataService.checkIfTagHasAlarm(tag)) {
                                                if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                                    dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                                        if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                                            if (alarmsCounts[index] > tagAlarms.length - 1)
                                                                alarmsCounts[index] = 0;

                                                            dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);

                                                            if (tagAlarms.length !== prevAlarmCounts[index]) {
                                                                google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                                                                dataService.dynamicTags[tagIndex].addListener('click', () => {
                                                                    $mdDialog.show({
                                                                        locals             : {tag: tag},
                                                                        templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                                                        parent             : angular.element(document.body),
                                                                        targetEvent        : event,
                                                                        clickOutsideToClose: true,
                                                                        controller         : ['$scope', 'tag', ($scope, tag) => {
                                                                            $scope.tag          = tag;
                                                                            $scope.isTagInAlarm = 'background-red';

                                                                            $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);

                                                                            if ($scope.alarms.length === 0) {
                                                                                ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                                                                                    ? $scope.isTagInAlarm = 'background-gray'
                                                                                    : $scope.isTagInAlarm = 'background-green';
                                                                            }

                                                                            $scope.hide = () => {
                                                                                $mdDialog.hide();
                                                                            }
                                                                        }]
                                                                    })
                                                                })
                                                            }
                                                        }
                                                    });
                                                } else {
                                                    dataService.setIcon(tag, marker);
                                                    dataService.dynamicTags.push(marker);
                                                    marker.setMap(map);
                                                    bounds.extend(marker.getPosition());
                                                }
                                            } else {
                                                if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                                    marker.setIcon(tagsIconPath + 'offline_tag_24.png')
                                                    dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                                        if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                                            dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                                                        }
                                                    });
                                                } else {
                                                    marker.setIcon(tagsIconPath + 'offline_tag_24.png');
                                                    dataService.dynamicTags.push(marker);
                                                    marker.setMap(map);
                                                    bounds.extend(marker.getPosition());
                                                }
                                            }
                                        } else {
                                            if (dataService.checkIfTagHasAlarm(tag)) {
                                                if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                                    dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                                        if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                                            if (alarmsCounts[index] > tagAlarms.length - 1)
                                                                alarmsCounts[index] = 0;

                                                            dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);

                                                            if (tagAlarms.length !== prevAlarmCounts[index]) {
                                                                google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                                                                dataService.dynamicTags[tagIndex].addListener('click', () => {
                                                                    $mdDialog.show({
                                                                        locals             : {tag: tag},
                                                                        templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                                                        parent             : angular.element(document.body),
                                                                        targetEvent        : event,
                                                                        clickOutsideToClose: true,
                                                                        controller         : ['$scope', 'tag', ($scope, tag) => {
                                                                            $scope.tag          = tag;
                                                                            $scope.isTagInAlarm = 'background-red';

                                                                            $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);

                                                                            if ($scope.alarms.length === 0) {
                                                                                ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                                                                                    ? $scope.isTagInAlarm = 'background-gray'
                                                                                    : $scope.isTagInAlarm = 'background-green';
                                                                            }

                                                                            $scope.hide = () => {
                                                                                $mdDialog.hide();
                                                                            }
                                                                        }]
                                                                    })
                                                                })
                                                            }
                                                        }
                                                    });
                                                } else {
                                                    marker.setIcon(tagsIconPath + 'offline_tag_24.png')
                                                    dataService.dynamicTags.push(marker);
                                                    marker.setMap(map);
                                                    bounds.extend(marker.getPosition());
                                                }
                                            } else {
                                                dataService.dynamicTags.forEach((tag, index) => {
                                                    if (tag.getPosition().equals(marker.getPosition())) {
                                                        dataService.dynamicTags[index].setMap(null);
                                                        dataService.dynamicTags.splice(index, 1);
                                                    }
                                                });
                                            }
                                            // console.log('empty tags, tags have no alarm', dataService.dynamicTags);
                                            // dataService.dynamicTags.forEach((tag, index) => {
                                            //     if (!dataService.checkIfTagHasAlarm(tag)) {
                                            //         if (tag.getPosition().equals(marker.getPosition())) {
                                            //             dataService.dynamicTags[index].setMap(null);
                                            //             dataService.dynamicTags.splice(index, 1);
                                            //         }
                                            //     }
                                            // });
                                        }
                                    } else if (dataService.checkIfTagHasAlarm(tag)) {
                                        if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                                            dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                                if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {

                                                    if (alarmsCounts[index] > tagAlarms.length - 1)
                                                        alarmsCounts[index] = 0;

                                                    dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);


                                                    if (tagAlarms.length !== prevAlarmCounts[index]) {
                                                        google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                                                        dataService.dynamicTags[tagIndex].addListener('click', () => {
                                                            $mdDialog.show({
                                                                locals             : {tag: tag},
                                                                templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                                                parent             : angular.element(document.body),
                                                                targetEvent        : event,
                                                                clickOutsideToClose: true,
                                                                controller         : ['$scope', 'tag', ($scope, tag) => {
                                                                    $scope.tag          = tag;
                                                                    $scope.isTagInAlarm = 'background-red';

                                                                    $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);

                                                                    if ($scope.alarms.length === 0) {
                                                                        ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                                                                            ? $scope.isTagInAlarm = 'background-gray'
                                                                            : $scope.isTagInAlarm = 'background-green';
                                                                    }

                                                                    $scope.hide = () => {
                                                                        $mdDialog.hide();
                                                                    }
                                                                }]
                                                            })
                                                        })
                                                    }
                                                }
                                            });
                                        } else {
                                            dataService.setIcon(tag, marker);
                                            marker.setMap(map);
                                            dataService.dynamicTags.push(marker);
                                            bounds.extend(marker.getPosition());
                                        }
                                    } else {
                                        dataService.dynamicTags.forEach((tag, index) => {
                                            if (tag.getPosition().equals(marker.getPosition())) {
                                                dataService.dynamicTags[index].setMap(null);
                                                dataService.dynamicTags.splice(index, 1);
                                            }
                                        });
                                    }

                                    prevAlarmCounts[index] = tagAlarms.length;
                                }
                            // }
                        });

                        // if (dataService.checkIfTagOutOfLocationHasAlarm(tags)) {
                        //     tags.forEach((tag, index) => {
                        //         console.log(tag)
                        //         if (dataService.isOutdoor(tag)) {
                        //             if ((dataService.getTagDistanceFromLocationOrigin(tag, [locationInfo.latitude, locationInfo.longitude])) <= locationInfo.radius) {
                        //                 // console.log(tag);
                        //                 tagAlarms = dataService.getTagAlarms(tag);
                        //
                        //                 let marker = new google.maps.Marker({
                        //                     position: new google.maps.LatLng(tag.gps_north_degree, tag.gps_east_degree),
                        //                 });
                        //
                        //                 //showing the info window of the tag when clicked
                        //                 marker.addListener('click', () => {
                        //                     $mdDialog.show({
                        //                         locals             : {tag: tag},
                        //                         templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                         parent             : angular.element(document.body),
                        //                         targetEvent        : event,
                        //                         clickOutsideToClose: true,
                        //                         controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                             $scope.tag          = tag;
                        //                             $scope.isTagInAlarm = 'background-red';
                        //                             $scope.alarms       = [];
                        //
                        //                             $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                             if ($scope.alarms.length === 0) {
                        //                                 ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                     ? $scope.isTagInAlarm = 'background-gray'
                        //                                     : $scope.isTagInAlarm = 'background-green';
                        //                             }
                        //
                        //                             $scope.hide = () => {
                        //                                 $mdDialog.hide();
                        //                             }
                        //                         }]
                        //                     })
                        //                 });
                        //
                        //                 //controlling if the tag is online and if has to be shown, if yes I show the tags on the map
                        //                 if ((new Date(Date.now()) - (new Date(tag.gps_time)) < tag.sleep_time_outdoor)) {
                        //                     //showing the tags only for the admin user for the privacy problem
                        //                     if (dataService.checkIfTagHasAlarm(tag)) {
                        //                         if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                             dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                 if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                     if (alarmsCounts[index] > tagAlarms.length - 1)
                        //                                         alarmsCounts[index] = 0;
                        //
                        //                                     dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                        //
                        //                                     if (tagAlarms.length !== prevAlarmCounts[index]) {
                        //                                         google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                        //                                         dataService.dynamicTags[tagIndex].addListener('click', () => {
                        //                                             $mdDialog.show({
                        //                                                 locals             : {tag: tag},
                        //                                                 templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                                                 parent             : angular.element(document.body),
                        //                                                 targetEvent        : event,
                        //                                                 clickOutsideToClose: true,
                        //                                                 controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                                                     $scope.tag          = tag;
                        //                                                     $scope.isTagInAlarm = 'background-red';
                        //
                        //                                                     $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                                                     if ($scope.alarms.length === 0) {
                        //                                                         ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                                             ? $scope.isTagInAlarm = 'background-gray'
                        //                                                             : $scope.isTagInAlarm = 'background-green';
                        //                                                     }
                        //
                        //                                                     $scope.hide = () => {
                        //                                                         $mdDialog.hide();
                        //                                                     }
                        //                                                 }]
                        //                                             })
                        //                                         })
                        //                                     }
                        //                                 }
                        //                             });
                        //                         } else {
                        //                             dataService.setIcon(tag, marker);
                        //                             dataService.dynamicTags.push(marker);
                        //                             marker.setMap(map);
                        //                             bounds.extend(marker.getPosition());
                        //                         }
                        //                     } else if (!tag.radio_switched_off) {
                        //                         if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                             dataService.setIcon(tag, marker);
                        //                             dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                 if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                     dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                        //                                 }
                        //                             });
                        //                         } else {
                        //                             dataService.setIcon(tag, marker);
                        //                             dataService.dynamicTags.push(marker);
                        //                             marker.setMap(map);
                        //                             bounds.extend(marker.getPosition());
                        //                         }
                        //                     } else {
                        //                         dataService.dynamicTags.forEach((tag, index) => {
                        //                             if (tag.getPosition().equals(marker.getPosition())) {
                        //                                 dataService.dynamicTags[index].setMap(null);
                        //                                 dataService.dynamicTags.splice(index, 1);
                        //                             }
                        //                         });
                        //                     }
                        //                 }
                        //             }
                        //         }
                        //     })
                        // } else {
                        //     tags.forEach((tag, index) => {
                        //         if (dataService.isOutdoor(tag)) {
                        //             if ((dataService.getTagDistanceFromLocationOrigin(tag, [locationInfo.latitude, locationInfo.longitude])) <= locationInfo.radius) {
                        //                 // console.log(tag);
                        //                 tagAlarms = dataService.getTagAlarms(tag);
                        //
                        //                 let marker = new google.maps.Marker({
                        //                     position: new google.maps.LatLng(tag.gps_north_degree, tag.gps_east_degree),
                        //                 });
                        //
                        //                 //showing the info window of the tag when clicked
                        //                 marker.addListener('click', () => {
                        //                     $mdDialog.show({
                        //                         locals             : {tag: tag},
                        //                         templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                         parent             : angular.element(document.body),
                        //                         targetEvent        : event,
                        //                         clickOutsideToClose: true,
                        //                         controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                             $scope.tag          = tag;
                        //                             $scope.isTagInAlarm = 'background-red';
                        //                             $scope.alarms       = [];
                        //
                        //                             console.log($scope.tag);
                        //                             $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                             if ($scope.alarms.length === 0) {
                        //                                 ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                     ? $scope.isTagInAlarm = 'background-gray'
                        //                                     : $scope.isTagInAlarm = 'background-green';
                        //                             }
                        //
                        //                             $scope.hide = () => {
                        //                                 $mdDialog.hide();
                        //                             }
                        //                         }]
                        //                     })
                        //                 });
                        //
                        //                 //controlling if the tag is online and if has to be shown, if yes I show the tags on the map
                        //                 if ((new Date(Date.now()) - (new Date(tag.gps_time)) < tag.sleep_time_outdoor)) {
                        //                     //showing the tags only for the admin user for the privacy problem
                        //                     if (outdoorCtrl.isAdmin === 1) {
                        //                         if (dataService.checkIfTagHasAlarm(tag)) {
                        //                             if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                 dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                     if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                         if (alarmsCounts[index] > tagAlarms.length - 1)
                        //                                             alarmsCounts[index] = 0;
                        //
                        //                                         dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                        //
                        //                                         if (tagAlarms.length !== prevAlarmCounts[index]) {
                        //                                             google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                        //                                             dataService.dynamicTags[tagIndex].addListener('click', () => {
                        //                                                 $mdDialog.show({
                        //                                                     locals             : {tag: tag},
                        //                                                     templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                                                     parent             : angular.element(document.body),
                        //                                                     targetEvent        : event,
                        //                                                     clickOutsideToClose: true,
                        //                                                     controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                                                         $scope.tag          = tag;
                        //                                                         $scope.isTagInAlarm = 'background-red';
                        //
                        //                                                         $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                                                         if ($scope.alarms.length === 0) {
                        //                                                             ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                                                 ? $scope.isTagInAlarm = 'background-gray'
                        //                                                                 : $scope.isTagInAlarm = 'background-green';
                        //                                                         }
                        //
                        //                                                         $scope.hide = () => {
                        //                                                             $mdDialog.hide();
                        //                                                         }
                        //                                                     }]
                        //                                                 })
                        //                                             })
                        //                                         }
                        //                                     }
                        //                                 });
                        //                             } else {
                        //                                 dataService.setIcon(tag, marker);
                        //                                 dataService.dynamicTags.push(marker);
                        //                                 marker.setMap(map);
                        //                                 bounds.extend(marker.getPosition());
                        //                             }
                        //                         } else if (!tag.radio_switched_off) {
                        //                             if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                 dataService.setIcon(tag, marker);
                        //                                 dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                     if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                         dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                        //                                     }
                        //                                 });
                        //                             } else {
                        //                                 dataService.setIcon(tag, marker);
                        //                                 dataService.dynamicTags.push(marker);
                        //                                 marker.setMap(map);
                        //                                 bounds.extend(marker.getPosition());
                        //                             }
                        //                         } else {
                        //                             dataService.dynamicTags.forEach((tag, index) => {
                        //                                 if (tag.getPosition().equals(marker.getPosition())) {
                        //                                     dataService.dynamicTags[index].setMap(null);
                        //                                     dataService.dynamicTags.splice(index, 1);
                        //                                 }
                        //                             });
                        //                         }
                        //                     } else if (outdoorCtrl.isUserManager && dataService.switch.showOutdoorTags) {
                        //                         if (dataService.checkIfTagsHaveAlarmsOutdoor(tags)) {
                        //                             if (dataService.checkIfTagHasAlarm(tag)) {
                        //                                 if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                     dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                         if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                             if (alarmsCounts[index] > tagAlarms.length - 1)
                        //                                                 alarmsCounts[index] = 0;
                        //
                        //                                             dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                        //
                        //                                             if (tagAlarms.length !== prevAlarmCounts[index]) {
                        //                                                 google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                        //                                                 dataService.dynamicTags[tagIndex].addListener('click', () => {
                        //                                                     $mdDialog.show({
                        //                                                         locals             : {tag: tag},
                        //                                                         templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                                                         parent             : angular.element(document.body),
                        //                                                         targetEvent        : event,
                        //                                                         clickOutsideToClose: true,
                        //                                                         controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                                                             $scope.tag          = tag;
                        //                                                             $scope.isTagInAlarm = 'background-red';
                        //
                        //                                                             $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                                                             if ($scope.alarms.length === 0) {
                        //                                                                 ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                                                     ? $scope.isTagInAlarm = 'background-gray'
                        //                                                                     : $scope.isTagInAlarm = 'background-green';
                        //                                                             }
                        //
                        //                                                             $scope.hide = () => {
                        //                                                                 $mdDialog.hide();
                        //                                                             }
                        //                                                         }]
                        //                                                     })
                        //                                                 })
                        //                                             }
                        //                                         }
                        //                                     });
                        //                                 } else {
                        //                                     dataService.setIcon(tag, marker);
                        //                                     dataService.dynamicTags.push(marker);
                        //                                     marker.setMap(map);
                        //                                     bounds.extend(marker.getPosition());
                        //                                 }
                        //                             } else if (!tag.radio_switched_off) {
                        //                                 if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                     dataService.setIcon(tag, marker);
                        //                                     dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                         if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                             dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                        //                                         }
                        //                                     });
                        //                                 } else {
                        //                                     dataService.setIcon(tag, marker);
                        //                                     dataService.dynamicTags.push(marker);
                        //                                     marker.setMap(map);
                        //                                     bounds.extend(marker.getPosition());
                        //                                 }
                        //                             } else {
                        //                                 dataService.dynamicTags.forEach((tag, index) => {
                        //                                     if (tag.getPosition().equals(marker.getPosition())) {
                        //                                         dataService.dynamicTags[index].setMap(null);
                        //                                         dataService.dynamicTags.splice(index, 1);
                        //                                     }
                        //                                 });
                        //                             }
                        //                         } else {
                        //                             dataService.dynamicTags.forEach((tag, index) => {
                        //                                 if (tag.getPosition().equals(marker.getPosition())) {
                        //                                     dataService.dynamicTags[index].setMap(null);
                        //                                     dataService.dynamicTags.splice(index, 1);
                        //                                 }
                        //                             });
                        //                         }
                        //                     } else if (outdoorCtrl.isTracker) {
                        //                         console.log('isTracker');
                        //                         if (dataService.checkIfTagHasAlarm(tag)) {
                        //                             if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                 dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                     if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                         if (alarmsCounts[index] > tagAlarms.length - 1)
                        //                                             alarmsCounts[index] = 0;
                        //
                        //                                         dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                        //
                        //                                         if (tagAlarms.length !== prevAlarmCounts[index]) {
                        //                                             google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                        //                                             dataService.dynamicTags[tagIndex].addListener('click', () => {
                        //                                                 $mdDialog.show({
                        //                                                     locals             : {tag: tag},
                        //                                                     templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                                                     parent             : angular.element(document.body),
                        //                                                     targetEvent        : event,
                        //                                                     clickOutsideToClose: true,
                        //                                                     controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                                                         $scope.tag          = tag;
                        //                                                         $scope.isTagInAlarm = 'background-red';
                        //
                        //                                                         $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                                                         if ($scope.alarms.length === 0) {
                        //                                                             ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                                                 ? $scope.isTagInAlarm = 'background-gray'
                        //                                                                 : $scope.isTagInAlarm = 'background-green';
                        //                                                         }
                        //
                        //                                                         $scope.hide = () => {
                        //                                                             $mdDialog.hide();
                        //                                                         }
                        //                                                     }]
                        //                                                 })
                        //                                             })
                        //                                         }
                        //                                     }
                        //                                 });
                        //                             } else {
                        //                                 dataService.setIcon(tag, marker);
                        //                                 dataService.dynamicTags.push(marker);
                        //                                 marker.setMap(map);
                        //                                 bounds.extend(marker.getPosition());
                        //                             }
                        //                         } else if (!tag.radio_switched_off) {
                        //                             if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                 dataService.setIcon(tag, marker);
                        //                                 dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                     if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                         dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                        //                                     }
                        //                                 });
                        //                             } else {
                        //                                 dataService.setIcon(tag, marker);
                        //                                 dataService.dynamicTags.push(marker);
                        //                                 marker.setMap(map);
                        //                                 bounds.extend(marker.getPosition());
                        //                             }
                        //                         } else {
                        //                             dataService.dynamicTags.forEach((tag, index) => {
                        //                                 if (tag.getPosition().equals(marker.getPosition())) {
                        //                                     dataService.dynamicTags[index].setMap(null);
                        //                                     dataService.dynamicTags.splice(index, 1);
                        //                                 }
                        //                             });
                        //                         }
                        //                     } else {
                        //                         if (dataService.checkIfTagHasAlarm(tag)) {
                        //                             if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                 dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                     if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                         if (alarmsCounts[index] > tagAlarms.length - 1)
                        //                                             alarmsCounts[index] = 0;
                        //
                        //                                         dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                        //
                        //                                         if (tagAlarms.length !== prevAlarmCounts[index]) {
                        //                                             google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                        //                                             dataService.dynamicTags[tagIndex].addListener('click', () => {
                        //                                                 $mdDialog.show({
                        //                                                     locals             : {tag: tag},
                        //                                                     templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                                                     parent             : angular.element(document.body),
                        //                                                     targetEvent        : event,
                        //                                                     clickOutsideToClose: true,
                        //                                                     controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                                                         $scope.tag          = tag;
                        //                                                         $scope.isTagInAlarm = 'background-red';
                        //
                        //                                                         $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                                                         if ($scope.alarms.length === 0) {
                        //                                                             ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                                                 ? $scope.isTagInAlarm = 'background-gray'
                        //                                                                 : $scope.isTagInAlarm = 'background-green';
                        //                                                         }
                        //
                        //                                                         $scope.hide = () => {
                        //                                                             $mdDialog.hide();
                        //                                                         }
                        //                                                     }]
                        //                                                 })
                        //                                             })
                        //                                         }
                        //                                     }
                        //                                 });
                        //                             } else {
                        //                                 dataService.setIcon(tag, marker);
                        //                                 dataService.dynamicTags.push(marker);
                        //                                 marker.setMap(map);
                        //                                 bounds.extend(marker.getPosition());
                        //                             }
                        //                         } else if (!tag.radio_switched_off) {
                        //                             dataService.dynamicTags.forEach((tag, index) => {
                        //                                 if (tag.getPosition().equals(marker.getPosition())) {
                        //                                     dataService.dynamicTags[index].setMap(null);
                        //                                     dataService.dynamicTags.splice(index, 1);
                        //                                 }
                        //                             });
                        //                         } else {
                        //                             dataService.dynamicTags.forEach((tag, index) => {
                        //                                 if (tag.getPosition().equals(marker.getPosition())) {
                        //                                     dataService.dynamicTags[index].setMap(null);
                        //                                     dataService.dynamicTags.splice(index, 1);
                        //                                 }
                        //                             });
                        //                         }
                        //                     }
                        //                 } else if (!tag.radio_switched_off) {
                        //                     if (outdoorCtrl.isAdmin) {
                        //                         if (dataService.checkIfTagHasAlarm(tag)) {
                        //                             if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                 dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                     if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                         if (alarmsCounts[index] > tagAlarms.length - 1)
                        //                                             alarmsCounts[index] = 0;
                        //
                        //                                         dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                        //
                        //                                         if (tagAlarms.length !== prevAlarmCounts[index]) {
                        //                                             google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                        //                                             dataService.dynamicTags[tagIndex].addListener('click', () => {
                        //                                                 $mdDialog.show({
                        //                                                     locals             : {tag: tag},
                        //                                                     templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                                                     parent             : angular.element(document.body),
                        //                                                     targetEvent        : event,
                        //                                                     clickOutsideToClose: true,
                        //                                                     controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                                                         $scope.tag          = tag;
                        //                                                         $scope.isTagInAlarm = 'background-red';
                        //
                        //                                                         $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                                                         if ($scope.alarms.length === 0) {
                        //                                                             ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                                                 ? $scope.isTagInAlarm = 'background-gray'
                        //                                                                 : $scope.isTagInAlarm = 'background-green';
                        //                                                         }
                        //
                        //                                                         $scope.hide = () => {
                        //                                                             $mdDialog.hide();
                        //                                                         }
                        //                                                     }]
                        //                                                 })
                        //                                             })
                        //                                         }
                        //                                     }
                        //                                 });
                        //                             } else {
                        //                                 dataService.setIcon(tag, marker);
                        //                                 dataService.dynamicTags.push(marker);
                        //                                 marker.setMap(map);
                        //                                 bounds.extend(marker.getPosition());
                        //                             }
                        //                         } else {
                        //                             if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                 marker.setIcon(tagsIconPath + 'offline_tag_24.png')
                        //                                 dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                     if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                         dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                        //                                     }
                        //                                 });
                        //                             } else {
                        //                                 marker.setIcon(tagsIconPath + 'offline_tag_24.png');
                        //                                 dataService.dynamicTags.push(marker);
                        //                                 marker.setMap(map);
                        //                                 bounds.extend(marker.getPosition());
                        //                             }
                        //                         }
                        //                     } else if (outdoorCtrl.isUserManager && dataService.switch.showOutdoorTags) {
                        //                         if (dataService.checkIfTagsHaveAlarmsOutdoor(tags)) {
                        //                             if (dataService.checkIfTagHasAlarm(tag)) {
                        //                                 if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                     dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                         if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                             if (alarmsCounts[index] > tagAlarms.length - 1)
                        //                                                 alarmsCounts[index] = 0;
                        //
                        //                                             dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                        //
                        //                                             if (tagAlarms.length !== prevAlarmCounts[index]) {
                        //                                                 google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                        //                                                 dataService.dynamicTags[tagIndex].addListener('click', () => {
                        //                                                     $mdDialog.show({
                        //                                                         locals             : {tag: tag},
                        //                                                         templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                                                         parent             : angular.element(document.body),
                        //                                                         targetEvent        : event,
                        //                                                         clickOutsideToClose: true,
                        //                                                         controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                                                             $scope.tag          = tag;
                        //                                                             $scope.isTagInAlarm = 'background-red';
                        //
                        //                                                             $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                                                             if ($scope.alarms.length === 0) {
                        //                                                                 ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                                                     ? $scope.isTagInAlarm = 'background-gray'
                        //                                                                     : $scope.isTagInAlarm = 'background-green';
                        //                                                             }
                        //
                        //                                                             $scope.hide = () => {
                        //                                                                 $mdDialog.hide();
                        //                                                             }
                        //                                                         }]
                        //                                                     })
                        //                                                 })
                        //                                             }
                        //                                         }
                        //                                     });
                        //                                 } else {
                        //                                     dataService.setIcon(tag, marker);
                        //                                     dataService.dynamicTags.push(marker);
                        //                                     marker.setMap(map);
                        //                                     bounds.extend(marker.getPosition());
                        //                                 }
                        //                             } else {
                        //                                 if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                     marker.setIcon(tagsIconPath + 'offline_tag_24.png')
                        //                                     dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                         if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                             dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                        //                                         }
                        //                                     });
                        //                                 } else {
                        //                                     marker.setIcon(tagsIconPath + 'offline_tag_24.png')
                        //                                     dataService.dynamicTags.push(marker);
                        //                                     marker.setMap(map);
                        //                                     bounds.extend(marker.getPosition());
                        //                                 }
                        //                             }
                        //                         } else {
                        //                             dataService.dynamicTags.forEach((tag, index) => {
                        //                                 if (tag.getPosition().equals(marker.getPosition())) {
                        //                                     dataService.dynamicTags[index].setMap(null);
                        //                                     dataService.dynamicTags.splice(index, 1);
                        //                                 }
                        //                             });
                        //                         }
                        //                     } else if (outdoorCtrl.isTracker) {
                        //                         console.log('istracker');
                        //                         if (dataService.checkIfTagHasAlarm(tag)) {
                        //                             if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                 dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                     if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                         if (alarmsCounts[index] > tagAlarms.length - 1)
                        //                                             alarmsCounts[index] = 0;
                        //
                        //                                         dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                        //
                        //                                         if (tagAlarms.length !== prevAlarmCounts[index]) {
                        //                                             google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                        //                                             dataService.dynamicTags[tagIndex].addListener('click', () => {
                        //                                                 $mdDialog.show({
                        //                                                     locals             : {tag: tag},
                        //                                                     templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                                                     parent             : angular.element(document.body),
                        //                                                     targetEvent        : event,
                        //                                                     clickOutsideToClose: true,
                        //                                                     controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                                                         $scope.tag          = tag;
                        //                                                         $scope.isTagInAlarm = 'background-red';
                        //
                        //                                                         $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                                                         if ($scope.alarms.length === 0) {
                        //                                                             ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                                                 ? $scope.isTagInAlarm = 'background-gray'
                        //                                                                 : $scope.isTagInAlarm = 'background-green';
                        //                                                         }
                        //
                        //                                                         $scope.hide = () => {
                        //                                                             $mdDialog.hide();
                        //                                                         }
                        //                                                     }]
                        //                                                 })
                        //                                             })
                        //                                         }
                        //                                     }
                        //                                 });
                        //                             } else {
                        //                                 dataService.setIcon(tag, marker);
                        //                                 dataService.dynamicTags.push(marker);
                        //                                 marker.setMap(map);
                        //                                 bounds.extend(marker.getPosition());
                        //                             }
                        //                         } else {
                        //                             if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                 marker.setIcon(tagsIconPath + 'offline_tag_24.png')
                        //                                 dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                     if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                         dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                        //                                     }
                        //                                 });
                        //                             } else {
                        //                                 marker.setIcon(tagsIconPath + 'offline_tag_24.png');
                        //                                 dataService.dynamicTags.push(marker);
                        //                                 marker.setMap(map);
                        //                                 bounds.extend(marker.getPosition());
                        //                             }
                        //                         }
                        //                     } else {
                        //                         if (dataService.checkIfTagHasAlarm(tag)) {
                        //                             if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                                 dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                                     if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //                                         if (alarmsCounts[index] > tagAlarms.length - 1)
                        //                                             alarmsCounts[index] = 0;
                        //
                        //                                         dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                        //
                        //                                         if (tagAlarms.length !== prevAlarmCounts[index]) {
                        //                                             google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                        //                                             dataService.dynamicTags[tagIndex].addListener('click', () => {
                        //                                                 $mdDialog.show({
                        //                                                     locals             : {tag: tag},
                        //                                                     templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                                                     parent             : angular.element(document.body),
                        //                                                     targetEvent        : event,
                        //                                                     clickOutsideToClose: true,
                        //                                                     controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                                                         $scope.tag          = tag;
                        //                                                         $scope.isTagInAlarm = 'background-red';
                        //
                        //                                                         $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                                                         if ($scope.alarms.length === 0) {
                        //                                                             ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                                                 ? $scope.isTagInAlarm = 'background-gray'
                        //                                                                 : $scope.isTagInAlarm = 'background-green';
                        //                                                         }
                        //
                        //                                                         $scope.hide = () => {
                        //                                                             $mdDialog.hide();
                        //                                                         }
                        //                                                     }]
                        //                                                 })
                        //                                             })
                        //                                         }
                        //                                     }
                        //                                 });
                        //                             } else {
                        //                                 marker.setIcon(tagsIconPath + 'offline_tag_24.png')
                        //                                 dataService.dynamicTags.push(marker);
                        //                                 marker.setMap(map);
                        //                                 bounds.extend(marker.getPosition());
                        //                             }
                        //                         } else {
                        //                             dataService.dynamicTags.forEach((tag, index) => {
                        //                                 if (tag.getPosition().equals(marker.getPosition())) {
                        //                                     dataService.dynamicTags[index].setMap(null);
                        //                                     dataService.dynamicTags.splice(index, 1);
                        //                                 }
                        //                             });
                        //                         }
                        //                         // console.log('empty tags, tags have no alarm', dataService.dynamicTags);
                        //                         // dataService.dynamicTags.forEach((tag, index) => {
                        //                         //     if (!dataService.checkIfTagHasAlarm(tag)) {
                        //                         //         if (tag.getPosition().equals(marker.getPosition())) {
                        //                         //             dataService.dynamicTags[index].setMap(null);
                        //                         //             dataService.dynamicTags.splice(index, 1);
                        //                         //         }
                        //                         //     }
                        //                         // });
                        //                     }
                        //                 } else if (dataService.checkIfTagHasAlarm(tag)) {
                        //                     if (dataService.markerIsOnMap(dataService.dynamicTags, marker)) {
                        //                         dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                        //                             if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                        //
                        //                                 if (alarmsCounts[index] > tagAlarms.length - 1)
                        //                                     alarmsCounts[index] = 0;
                        //
                        //                                 dataService.dynamicTags[tagIndex].setIcon(tagAlarms[alarmsCounts[index]++]);
                        //
                        //
                        //                                 if (tagAlarms.length !== prevAlarmCounts[index]) {
                        //                                     google.maps.event.clearListeners(dataService.dynamicTags[tagIndex], 'click');
                        //                                     dataService.dynamicTags[tagIndex].addListener('click', () => {
                        //                                         $mdDialog.show({
                        //                                             locals             : {tag: tag},
                        //                                             templateUrl        : componentsPath + 'tag-info-outdoor.html',
                        //                                             parent             : angular.element(document.body),
                        //                                             targetEvent        : event,
                        //                                             clickOutsideToClose: true,
                        //                                             controller         : ['$scope', 'tag', ($scope, tag) => {
                        //                                                 $scope.tag          = tag;
                        //                                                 $scope.isTagInAlarm = 'background-red';
                        //
                        //                                                 $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);
                        //
                        //                                                 if ($scope.alarms.length === 0) {
                        //                                                     ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                        //                                                         ? $scope.isTagInAlarm = 'background-gray'
                        //                                                         : $scope.isTagInAlarm = 'background-green';
                        //                                                 }
                        //
                        //                                                 $scope.hide = () => {
                        //                                                     $mdDialog.hide();
                        //                                                 }
                        //                                             }]
                        //                                         })
                        //                                     })
                        //                                 }
                        //                             }
                        //                         });
                        //                     } else {
                        //                         dataService.setIcon(tag, marker);
                        //                         marker.setMap(map);
                        //                         dataService.dynamicTags.push(marker);
                        //                         bounds.extend(marker.getPosition());
                        //                     }
                        //                 } else {
                        //                     dataService.dynamicTags.forEach((tag, index) => {
                        //                         if (tag.getPosition().equals(marker.getPosition())) {
                        //                             dataService.dynamicTags[index].setMap(null);
                        //                             dataService.dynamicTags.splice(index, 1);
                        //                         }
                        //                     });
                        //                 }
                        //
                        //                 prevAlarmCounts[index] = tagAlarms.length;
                        //             }
                        //         }
                        //     });
                        // }

                        // Setting automatically the center of the map
                        if (dataService.dynamicTags.length === 1) {
                        map.setCenter(bounds.getCenter());
                        } else if (dataService.dynamicTags.length > 1) {
                        map.setCenter(bounds.getCenter());
                        } else {
                        let latLng = new google.maps.LatLng(dataService.location.latitude, dataService.location.longitude);
                        map.setCenter(latLng);
                        }
                    });
                });

                newSocketService.getData('get_anchors_by_user', {user: dataService.user.username}, (response) => {
                    outdoorCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(response.result);
                });

                newSocketService.getData('get_engine_on', {}, (response) => {
                    outdoorCtrl.showEngineOffIcon = response.result === 0;
                });
            }, 1000)

            let latLng = new google.maps.LatLng(dataService.location.latitude, dataService.location.longitude);
            map.setCenter(latLng);
        };

        let setOutdoorMarker = (mapMarker, tag, alarmsCounts, index, tagAlarms, prevAlarmCounts, map) => {
            if (mapMarker !== -1) {
                // control if the tag has alarms so that I show the alarm tag
                if (dataService.checkIfTagHasAlarm(tag)) {
                    // control if the marker corresponding to the tag position is on map
                    // if yes I change the icon of the marker on the map

                    if (alarmsCounts[index] > tagAlarms.length - 1) {
                        alarmsCounts[index] = 0;
                    }

                    dataService.dynamicTags[mapMarker].setIcon(tagAlarms[alarmsCounts[index]++]);

                    if (tagAlarms.length !== prevAlarmCounts[index]) {
                        google.maps.event.clearListeners(dataService.dynamicTags[mapMarker], 'click');
                        dataService.dynamicTags[mapMarker].addListener('click', () => {
                            $mdDialog.show({
                                locals             : {tag: tag},
                                templateUrl        : componentsPath + 'tag-info-outdoor.html',
                                parent             : angular.element(document.body),
                                targetEvent        : event,
                                clickOutsideToClose: true,
                                controller         : ['$scope', 'tag', ($scope, tag) => {
                                    $scope.tag          = tag;
                                    $scope.isTagInAlarm = 'background-red';

                                    $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag, null, null);

                                    if ($scope.alarms.length === 0) {
                                        (!$scope.tag.radio_switched_off)
                                            ? $scope.isTagInAlarm = 'background-gray'
                                            : $scope.isTagInAlarm = 'background-green';
                                    }

                                    $scope.hide = () => {
                                        $mdDialog.hide();
                                    }
                                }]
                            })
                        })
                    }
                }
                // controlling if the tag is not off
                else if (!tag.radio_switched_off) {
                    dataService.setMarkerOnlineIcon(dataService.dynamicTags[mapMarker]);
                }
                // removing the tag from the map if is turned off
                else {
                    dataService.dynamicTags[mapMarker].setMap(null);
                    dataService.dynamicTags.splice(mapMarker, 1);
                }
            }
            // putting the new marker on the map
            else if (!tag.radio_switched_off) {
                dataService.dynamicTags.push(marker);
                marker.setMap(map);
                bounds.extend(marker.getPosition());
            } else {
                dataService.dynamicTags[mapMarker].setMap(null);
                dataService.dynamicTags.splice(mapMarker, 1);
            }
        };

        $scope.centerMap = () => {
            console.log('centering the map');
            let latLng = new google.maps.LatLng(dataService.location.latitude, dataService.location.longitude);
            controllerMap.setCenter(latLng);
        };

        $rootScope.$on('constantUpdateMapTags', function (event, map) {
            constantUpdateMapTags(map);
        });

        //funzione che riporta alla home del sito
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