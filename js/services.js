(function () {
    'use strict';

    //reloading angular module
    let main = angular.module('main');


    //SERVICES
    main.service('dataService', dataService);
    main.service('recoverPassService', recoverPassService);
    main.service('socketService', socketService);
    main.service('newSocketService', newSocketService);

    dataService.$inject = ['$mdDialog', '$interval', '$state', 'socketService', 'newSocketService'];

    function dataService($mdDialog, $interval, $state, socketService, newSocketService) {
        let service = this;
        let socket = socketService.getSocket();

        service.user             = '';
        service.location             = '';
        service.locationFromClick    = '';
        service.isAdmin              = '';
        service.defaultFloorName     = '';
        service.tags                 = [];
        service.userTags                 = [];
        service.floorTags            = [];
        service.anchors              = [];
        service.locationAnchors              = [];
        service.anchorsToUpdate              = [];
        service.floors               = [];
        service.userFloors           = [];
        service.cameras              = [];
        service.alarmsSounds         = [];
        service.dynamicTags          = [];
        service.updateMapTimer       = null;
        service.canvasInterval       = undefined;
        service.mapInterval          = undefined;
        service.userInterval          = undefined;
        service.superUserInterval          = undefined;
        service.playAlarm            = true;
        service.isLocationInside = 0;
        service.isSearchingTag       = false;
        service.offlineTagsIsOpen    = false;
        service.offlineAnchorsIsOpen = false;
        service.defaultFloorCanceled = false;
        service.homeMap = null;
        service.drawingManagerRect = null;
        service.drawingManagerRound = null;
        service.outdoorZones = [];
        service.outdoorZoneInserted = false;
        // service.gridSpacing = 0;

        //#####################################################################
        //#                             HOME FUNCTIONS                        #
        //#####################################################################

        //getting the anchors in the location passed as parameter
        service.getLocationAnchors = (location, anchors) => {
            return anchors.filter(a => (a.location_latitude === location.position[0] && a.location_longitude === location.position[1]));
        };

        //controlling if the alarms array passed as parameter contains an alarm in the location passed as parameter as well
        service.alarmLocationsContainLocation = (alarms, location) => {
            return alarms.some(l => l.position[0] === location.position[0] && l.position[1] === location.position[1])
        };

        //getting the tags in the outdoor location passed as parameter
        service.getOutdoorLocationTags = (location, tags) => {
            return tags.filter(t => service.isTagInLocation(t, location));
        };

        //controlling if the tag passed as parameter is in the location passed as parameter as well
        service.isTagInLocation = (tag, location) => {
            return service.getTagDistanceFromLocationOrigin(tag, location.position) <= location.radius;
        };

        //calculating the distance of the tag from the location center to see if the tag is in the location area
        service.getTagDistanceFromLocationOrigin = (tag, origin) => {

            if (tag.gps_north_degree !== -1 && tag.gps_east_degree !== -1 && tag.gps_north_degree !== -2 && tag.gps_east_degree !== -2) {
                let distX = Math.abs(tag.gps_north_degree - origin[0]);
                let distY = Math.abs(tag.gps_east_degree - origin[1]);

                return Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2));
            }else {
                return Number.MAX_VALUE;
            }
        };

        //getting the tags in the location indoor passed as parameter
        service.getIndoorLocationTags = (location, tags) => {
            return tags.filter(t => (location.position[0] === t.location_latitude && location.position[1] === t.location_longitude))
        };

        service.loadUserSettings = () => {
            newSocketService.getData('get_user_settings', {username: service.user.username}, (response) => {
                if (!response.session_state)
                    window.location.reload();

                if(response.result.length !== 0) {
                    service.switch = {
                        showGrid   : (response.result[0].grid_on === 1),
                        showAnchors: (response.result[0].anchors_on === 1),
                        showCameras: (response.result[0].cameras_on === 1),
                        showOutrangeTags: (response.result[0].outag_on === 1),
                        showOutdoorTags: (response.result[0].outdoor_tag_on === 1),
                        showZones: (response.result[0].zones_on === 1),
                        playAudio  : (response.result[0].sound_on === 1),
                        showRadius : true,
                        showOutdoorRectDrawing: false,
                        showOutdoorRoundDrawing: false
                    };
                }
            })
        };

        //stopping the passed interval timer and resetting it
        service.stopTimer = (timer) => {
            if (timer !== undefined){
                $interval.cancel(timer);
            }

            return undefined;
        };

        service.checkIfTagsAreOutOfLocations = (tags) => {
            let tagOutOfLocation = false;
            tags.forEach(tag => {
                if (service.isOutdoor(tag) && (tag.gps_north_degree === -2 && tag.gps_east_degree === -2)){
                    tagOutOfLocation = true;
                } else if (!service.isOutdoor(tag) && tag.anchor_id === null){
                    tagOutOfLocation = true;
                } else {
                    newSocketService.getData('get_user_locations', service.user.id, (response) => {
                        tagOutOfLocation = response.result.some(l => !service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius)
                    })
                }
            });

            return tagOutOfLocation;
        };

        service.updateUserSettings = () => {
            let data = {grid_on: service.switch.showGrid, anchors_on: service.switch.showAnchors, cameras_on: service.switch.showCameras, outag_on: service.switch.showOutrangeTags, outdoor_tag_on: service.switch.showOutdoorTags, zones_on: service.switch.showZones, sound_on: service.switch.playAudio};
            let stringifyData = JSON.stringify(data);
            let id = ++requestId;

            socket.send(encodeRequestWithId(id, 'update_user_settings', {username: service.user.username, data: stringifyData}));
            socket.onmessage = (response) => {
                let parsedResponse = parseResponse(response);
                if (parsedResponse.id === id){
                    if (!parsedResponse.session_state)
                        window.location.reload();

                    service.loadUserSettings();
                }
            };
        };


        //function that show a window with the tags state
        service.showOfflineTags = (position, constantUpdateNotifications, map) => {

            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor_offline_tags_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', '$controller', function ($scope, $controller) {
                    $controller('languageController', {$scope: $scope});
                    $scope.offlineTagsIndoor = [];
                    $scope.offgridTags       = [];
                    $scope.offTags       = [];
                    $scope.data              = [];

                    $scope.tagsStateIndoor = {
                        offline: 0,
                        online : 0,
                        offGrid: 0,
                        offTags: 0
                    };

                    $scope.colors = ["#D3D3D3", "#4BAE5A", "#E12315", "#F76E41"];
                    $scope.labels = [lang.disabledTags, lang.activeTags, lang.shutDownTags, lang.lostTags];

                    service.offlineTagsInterval     = $interval(function () {
                        newSocketService.getData('get_all_tags', {}, (response) => {
                            if (!response.session_state)
                                window.location.reload();

                            let offGridTagsIndoor  = response.result.filter(t => (t.gps_north_degree === 0 && t.gps_east_degree === 0) && (t.type_id !== 1 && t.type_id !== 14) && !t.radio_switched_off && ((Date.now() - new Date(t.time)) > t.sleep_time_indoor));
                            let offGridTagsOutdoor = response.result.filter(t => (t.gps_north_degree !== 0 && t.gps_east_degree !== 0) && !t.radio_switched_off && ((Date.now() - new Date(t.gps_time)) > t.sleep_time_outdoor));

                            let tempOffTags = response.result.filter(t => ((t.type_id === 1 || t.type_id === 14) && (t.is_exit && t.radio_switched_off) || (t.type_id !== 1 && t.type_id !== 14 && t.radio_switched_off)));

                            if (!angular.equals(tempOffTags, $scope.offTags)){
                                $scope.offTags = tempOffTags;
                            }

                            $scope.tagsStateIndoor.offTags = $scope.offTags.length;

                            let tempOffGrid = [];

                            offGridTagsIndoor.forEach(elem => {
                                tempOffGrid.push(elem);
                            });

                            offGridTagsOutdoor.forEach(elem => {
                                tempOffGrid.push(elem);
                            });

                            if (!angular.equals(tempOffGrid, $scope.offgridTags)){
                                $scope.offgridTags             = tempOffGrid;
                            }
                            let tempOfflineTagsIndoor = response.result.filter(t => (t.is_exit && !t.radio_switched_off));
                            if (!angular.equals(tempOfflineTagsIndoor, $scope.offlineTagsIndoor)){
                                $scope.offlineTagsIndoor       = tempOfflineTagsIndoor;
                            }

                            $scope.tagsStateIndoor.offline = $scope.offlineTagsIndoor.length;
                            $scope.tagsStateIndoor.online  = response.result.length - $scope.offlineTagsIndoor.length - (offGridTagsIndoor.length + offGridTagsOutdoor.length) - $scope.offTags.length;
                            $scope.tagsStateIndoor.offGrid = offGridTagsIndoor.length + offGridTagsOutdoor.length;

                            $scope.data = [$scope.tagsStateIndoor.offline, $scope.tagsStateIndoor.online, $scope.tagsStateIndoor.offTags, $scope.tagsStateIndoor.offGrid];

                        });
                    }, 1000);

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function(){
                    service.offlineTagsInterval = service.stopTimer(service.offlineTagsInterval);

                    switch (position) {
                        case 'home':
                            if (service.homeTimer === undefined)
                                constantUpdateNotifications(map);
                            break;
                        case 'outside':
                            if (service.updateMapTimer === undefined)
                                constantUpdateNotifications(map);
                            break;
                        case 'canvas':
                            if (service.canvasInterval === undefined)
                                constantUpdateNotifications();
                    }
                },
            });
        };

        //checking if there is at least one tag offline
        service.checkIfTagsAreOffline = (tags) => {
            return tags.some(function (tag) {
                return ((tag.gps_north_degree === 0 && tag.gps_east_degree === 0) && (tag.type_id === 1 || tag.type_id === 14) && (tag.is_exit && !tag.radio_switched_off))
                    || ((tag.gps_north_degree !== 0 && tag.gps_east_degree !== 0) && !tag.radio_switched_off && (((Date.now() - new Date(tag.gps_time)) > tag.sleep_time_outdoor)))
                    || ((tag.gps_north_degree === 0 && tag.gps_east_degree === 0) && (tag.type_id !== 1 && tag.type_id !== 14) && !tag.radio_switched_off && (((Date.now() - new Date(tag.time)) > tag.sleep_time_indoor)));
            })
        };

        //checking if there is at least an anchor offline
        service.checkIfAnchorsAreOffline = (anchors) => {
            return anchors.some(function (anchor) {
                return anchor.is_offline || anchor.battery_status === 1;
            });
        };

        //checking if there is at least an anchor offline
        service.checkIfAreAnchorsOffline = (anchors) => {
            return anchors.some(function (anchor) {
                return anchor.is_offline === 1;
            });
        };


        //#####################################################################
        //#                          OUTDOOR FUNCTIONS                        #
        //#####################################################################



        //function that sets an icon image to the marker passed as parameter
        service.setIcon = (tag, marker) => {
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
            } else {
                marker.setIcon(tagsIconPath + 'online_tag_24.png');
            }
        };

        //function that controls if the passed marker is on the map
        service.markerIsOnMap = (markers, marker) => {
            return markers.some(m => m.getPosition().equals(marker.getPosition()));
        };

        //function tha maintain a local copy of the tags at n-1 time
        service.compareLocalTagsWithRemote = (remoteTags, localTags) => {
            let result = [];

            if (localTags.length === 0)
                angular.copy(remoteTags, localTags);

            localTags = localTags.filter(t => remoteTags.some(rt => rt.id === t.id));

            remoteTags.forEach((remote) => {
                let tag = localTags.find(t => t.id === remote.id);

                if (tag !== undefined) {
                    if (tag.gps_north_degree !== remote.gps_north_degree || tag.gps_east_degree !== remote.gps_east_degree)
                        result.push(tag);
                }
            });

            return result;
        };


        //#####################################################################
        //#                           CANVAS FUNCTIONS                        #
        //#####################################################################


        //function that loads all the images passed as parameter
        service.loadAlarmsImagesWithPromise = (images) => {
            return Promise.all(
                images.map(function (image) {
                    return new Promise(function (resolve) {
                        let localImage = new Image();

                        localImage.src    = image;
                        localImage.onload = function () {
                            resolve(localImage);
                        }
                    })
                })
            )
        };

        //grouping the tags in one object divided by clouds of tags and single tags
        service.groupNearTags = (tags, tag) => {
            let tagsGrouping = {
                groupTags : [],
                singleTags: []
            };

            tags.forEach(function (tagElement) {
                if (tag.id !== tagElement.id) {
                    if ((tagElement.x_pos - 0.5 < tag.x_pos && tag.x_pos < tagElement.x_pos + 0.5
                        && (tagElement.y_pos - 0.5 < tag.y_pos && tag.y_pos < tagElement.y_pos + 0.5))) {
                        if ((service.checkIfTagHasAlarm(tag)
                            || ((tag.tag_type_id !== 1 && tag.tag_type_id !== 14) && !tag.radio_switched_off)
                            || ((tag.tag_type_id === 1 || tag.tag_type_id === 14) && !(tag.is_exit && tag.radio_switched_off)))) {

                            if (!tagsGrouping.groupTags.some(t => t.id === tag.id)) {
                                tagsGrouping.groupTags.push(tag);
                            }
                        }

                        if (tagElement.tag_type_id !== 1 && tagElement.tag_type_id !== 14) {
                            if (service.checkIfTagHasAlarm(tagElement)) {
                                tagsGrouping.groupTags.push(tagElement)
                            } else if (!tagElement.radio_switched_off) {
                                tagsGrouping.groupTags.push(tagElement)
                            }
                        } else if ((tagElement.tag_type_id === 1 || tagElement.tag_type_id === 14)) {
                            if (service.checkIfTagHasAlarm(tagElement)) {
                                tagsGrouping.groupTags.push(tagElement);
                            } else if (!(tagElement.is_exit && tagElement.radio_switched_off)) {
                                tagsGrouping.groupTags.push(tagElement);
                            }
                        }
                    } else {
                        tagsGrouping.singleTags.push(tagElement);
                    }
                }
            });
            return tagsGrouping;
        };

        //showing the info window with the online/offline anchors
        service.showOfflineAnchors = (position, constantUpdateNotifications, map) => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor_offline_anchors_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', '$controller', 'dataService', function ($scope, $controller, dataService) {
                    $controller('languageController', {$scope: $scope});
                    $scope.offlineAnchors = [];
                    $scope.shutDownAnchors = [];
                    $scope.data           = [];

                    $scope.anchorsState = {
                        offline: 0,
                        online : 0,
                        shutDown: 0
                    };

                    $scope.colors = ["#D3D3D3", "#4BAE5A", "#E12315"];
                    $scope.labels = [$scope.lang.disabledAnchors, $scope.lang.enabledAnchors, $scope.lang.shutDownAnchors];

                    service.offlineAnchorsInterval = $interval(function () {
                        newSocketService.getData('get_anchors_by_user', {user: service.user.username}, (response) => {
                            if (!response.session_state)
                                window.location.reload();

                            let tempOfflineAnchors = response.result.filter(a => a.is_offline);

                            if (!angular.equals(tempOfflineAnchors, $scope.offlineAnchors)) {
                                $scope.offlineAnchors = tempOfflineAnchors;
                            }

                            let tempShutDonwAnchors = response.result.filter(a => a.battery_status === 1);

                            if (!angular.equals(tempShutDonwAnchors, $scope.shutDownAnchors)){
                                $scope.shutDownAnchors = tempShutDonwAnchors;
                            }

                            $scope.anchorsState.offline = $scope.offlineAnchors.length;
                            $scope.anchorsState.online  = response.result.length - $scope.offlineAnchors.length;
                            $scope.anchorsState.shutDown = $scope.shutDownAnchors.length;

                            $scope.data = [$scope.anchorsState.offline, $scope.anchorsState.online, $scope.anchorsState.shutDown];
                        });
                    }, 1000);


                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function(){
                    service.offlineAnchorsInterval = service.stopTimer(service.offlineAnchorsInterval);

                    switch (position) {
                        case 'home':
                            if (service.homeTimer === undefined)
                                constantUpdateNotifications(map);
                            break;
                        case 'outside':
                            if (service.updateMapTimer === undefined)
                                constantUpdateNotifications(map);
                            break;
                        case 'canvas':
                            if (service.canvasInterval === undefined)
                                constantUpdateNotifications();
                    }
                },
            })
        };

        //showing the info window with the online/offline anchors
        service.showOfflineAnchorsIndoor = (position, constantUpdateNotifications, map) => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor_offline_anchors_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', '$controller', 'dataService', function ($scope, $controller, dataService) {
                    $controller('languageController', {$scope: $scope});
                    $scope.offlineAnchors = [];
                    $scope.shutDownAnchors = [];
                    $scope.data           = [];

                    $scope.anchorsState = {
                        offline: 0,
                        online : 0,
                        shutDown: 0
                    };

                    $scope.colors = ["#D3D3D3", "#4BAE5A", "#E12315"];
                    $scope.labels = [$scope.lang.disabledAnchors, $scope.lang.enabledAnchors, $scope.lang.shutDownAnchors];

                    $interval.cancel(service.offlineTagsInterval);
                    service.offlineAnchorsInterval = $interval(function () {
                        let id = ++requestId;
                        socket.send(encodeRequestWithId(id, 'get_anchors_by_floor_and_location', {
                            floor: dataService.defaultFloorName,
                            location: dataService.location.name
                        }));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id) {
                                if (!parsedResponse.session_state)
                                    window.location.reload();

                                let tempOfflineAnchors = parsedResponse.result.filter(a => a.is_offline);

                                if (!angular.equals(tempOfflineAnchors, $scope.offlineAnchors)) {
                                    $scope.offlineAnchors = tempOfflineAnchors;
                                }

                                let tempShutDownAnchors = parsedResponse.result.filter(a => a.battery_status === 1);

                                if (!angular.equals(tempShutDownAnchors, $scope.shutDownAnchors)){
                                    $scope.shutDownAnchors = tempShutDownAnchors;
                                }

                                $scope.anchorsState.offline = $scope.offlineAnchors.length;
                                $scope.anchorsState.online  = parsedResponse.result.length - $scope.offlineAnchors.length;
                                $scope.anchorsState.shutDown = $scope.shutDownAnchors.length;

                                $scope.data = [$scope.anchorsState.offline, $scope.anchorsState.online, $scope.anchorsState.shutDown];
                            }
                        };
                    }, 1000);


                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function(){
                    if (service.offlineAnchorsInterval !== undefined) {
                        $interval.cancel(service.offlineAnchorsInterval);
                        service.offlineAnchorsInterval = undefined;
                        if (position === 'home') {
                            if (service.homeTimer === undefined)
                                constantUpdateNotifications(map);
                        }else if (position === 'outside') {
                            if (service.updateMapTimer === undefined)
                                constantUpdateNotifications(map);
                        }else if (position === 'canvas') {
                            if (service.canvasInterval === undefined)
                                constantUpdateNotifications();
                        }
                    }
                },
            })
        };

        //creating the informations to be shown on the info window of the canvas objects
        service.createAlarmObjectForInfoWindow = (tag, name, description, image, location) => {
            return {
                tagId      : tag.id,
                tag        : tag.name,
                name       : name,
                description: description,
                image      : image,
                location: location
            };
        };

        service.getAllLocations = () => {
            return socketService.sendRequest('get_all_locations');
        };

        service.isTagInLocation = (tag, location) => {
            return service.getTagDistanceFromLocationOrigin(tag, location.position) <= location.radius;
        };

        //getting all the alarms of the tag passed as parameter and creating the objects to be shown in info window
        service.loadTagAlarmsForInfoWindow = (tag, locations, tagLocation) => {
            let alarms = [];

            if (tag.sos) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.sos, lang.helpRequest,tagsIconPath + 'sos_24.png', tagLocation));
            }
            if (tag.man_down) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.manDown, lang.manDown, tagsIconPath + 'man_down_24.png', tagLocation));
            }
            if (tag.battery_status) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.batteryEmpty, lang.batteryEmpty, tagsIconPath + 'battery_low_24.png', tagLocation));
            }
            if (tag.helmet_dpi) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.helmetDpi, lang.helmetDpi, tagsIconPath + 'helmet_dpi_24.png', tagLocation));
            }
            if (tag.belt_dpi) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.beltDpi, lang.beltDpi, tagsIconPath + 'belt_dpi_24.png', tagLocation));
            }
            if (tag.glove_dpi) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.gloveDpi, lang.gloveDpi, tagsIconPath + 'glove_dpi_24.png', tagLocation));
            }
            if (tag.shoe_dpi) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.shoeDpi, lang.shoeDpi, tagsIconPath + 'shoe_dpi_24.png', tagLocation));
            }
            if (tag.man_down_disabled) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.manDownDisabled, lang.manDownDisabled, tagsIconPath + 'man_down_disbled_24.png', tagLocation));
            }
            if (tag.man_down_tacitated) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.manDownTacitated, lang.manDownTacitated, tagsIconPath + 'man_down_tacitated_24.png', tagLocation));
            }
            if (tag.man_in_quote) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.manInQuote, lang.manInQuote, tagsIconPath + 'man_in_quote_24.png', tagLocation));
            }
            if (tag.call_me_alarm) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.callMeAllarm, lang.callMeAllarm, tagsIconPath + 'call_me_alarm_24.png', tagLocation));
            }
            if (tag.inside_zone) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, lang.insideZone, lang.inside_zone, tagsIconPath + 'inside_zone_24.png', tagLocation));
            }

            if (locations !== null) {
                if (service.isOutdoor(tag) && locations.length > 0) {
                    let isInLocation = locations.some(l => service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) < l.radius);
                    if (!isInLocation) {
                        alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Tag fuori sito', "Il tag e' fuori da tutti i siti", tagsIconPath + 'tag_out_of_location_24.png'));
                    }
                }
            }

            return alarms;
        };

        service.getIndoorTagLocation = (tag) => {
            return new Promise(resolve => {
                socketService.sendRequest('get_indoor_tag_location', {tag: tag.id})
                    .then((response) => {
                        if (response.result.session_state)
                            window.location.reload();

                        console.log(response);
                        resolve(response.result);
                    })
            })
        };

        //function that controls if the passed alarm is in the array passed as well as parameter
        let controlIfAlarmIsInArray = (alarms, tag, alarmType) => {
            return alarms.some(a => a.tag === tag && a.alarm === alarmType);
        };

        //function that controls if the passed array has the passed alarm
        let controlIfArrayHasAlarm = (alarms, alarmType) => {
            let result = false;
            alarms.forEach(function (alarm) {
                if (alarm.alarm === alarmType)
                    result = true
            });

            return result;
        };

        //function that filters the alarms by the passed alarmType parameter
        let filterAlarms = (alarms, tag, alarmType) => {
            return alarms.filter(a => !(a.tag === tag && a.alarm === alarmType))
        };

        //function that checks if at least one tag has an alarm
        service.checkIfTagsHaveAlarms = (tags) => {
            return tags.some(function (tag) {
                return tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                    || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                    || tag.call_me_alarm || tag.diagnostic_request || tag.inside_zone;
            })
        };

        service.checkIfTagsHaveAlarmsOutdoor = (tags) => {
            return tags.some(tag => service.isOutdoor(tag) && (tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                || tag.call_me_alarm || tag.diagnostic_request));
        };

        service.checkIfAnchorsHaveAlarms = (anchors) => {
            return anchors.some(a => a.battery_status);
        };

        //function that plays the alarms audio of the tags passed as parameter
        service.playAlarmsAudio = (tags) => {
            let audio;
            tags.forEach(function (tag) {
                if (tag.battery_status) {
                    if (!controlIfAlarmIsInArray(service.alarmsSounds, tag.name, 'battery')) {
                        service.alarmsSounds.push({tag: tag.name, alarm: 'battery'});
                        service.playAlarm = true;
                    }
                } else {
                    service.alarmsSounds = filterAlarms(service.alarmsSounds, tag.name, 'battery');
                }

                if (tag.man_down) {
                    if (!controlIfAlarmIsInArray(service.alarmsSounds, tag.name, 'mandown')) {
                        service.alarmsSounds.push({tag: tag.name, alarm: 'mandown'});
                        service.playAlarm = true;
                    }
                } else {
                    service.alarmsSounds = filterAlarms(service.alarmsSounds, tag.name, 'mandown');
                }

                if (tag.sos) {
                    if (!controlIfAlarmIsInArray(service.alarmsSounds, tag.name, 'sos')) {
                        service.alarmsSounds.push({tag: tag.name, alarm: 'sos'});
                        service.playAlarm = true;
                    }
                } else {
                    service.alarmsSounds = filterAlarms(service.alarmsSounds, tag.name, 'sos');
                }
            });

            if (service.alarmsSounds.length > 1 && service.playAlarm && (service.switch && service.switch.playAudio)) {
                audio = new Audio(audioPath + 'sndMultipleAlarm.mp3');
                audio.play();
                service.playAlarm = false;
            } else {
                if (controlIfArrayHasAlarm(service.alarmsSounds, 'battery') && service.playAlarm && (service.switch && service.switch.playAudio)) {
                    audio = new Audio(audioPath + 'sndBatteryAlarm.mp3');
                    audio.play();
                }
                if (controlIfArrayHasAlarm(service.alarmsSounds, 'mandown') && service.playAlarm && (service.switch && service.switch.playAudio)) {
                    audio = new Audio(audioPath + 'sndManDownAlarm.mp3');
                    audio.play();
                }
                if (controlIfArrayHasAlarm(service.alarmsSounds, 'sos') && service.playAlarm && (service.switch && service.switch.playAudio)) {
                    audio = new Audio(audioPath + 'indila-sos.mp3');
                    audio.play();
                }

                service.playAlarm = false;
            }
        };

        //checking if the tag has an alarm
        service.checkIfTagHasAlarm = (tag) => {
            return tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                || tag.call_me_alarm || tag.diagnostic_request;
        };

        //function that returs the images of the alarms of the tags passed as parameter
        service.getTagAlarms = (tag) => {
            let tagAlarmsImages = [];

            if (tag.sos) {
                tagAlarmsImages.push(tagsIconPath + 'sos_24.png');
            }
            if (tag.man_down) {
                tagAlarmsImages.push(tagsIconPath + 'man_down_24.png');
            }
            if (tag.battery_status) {
                tagAlarmsImages.push(tagsIconPath + 'battery_low_24.png');
            }
            if (tag.helmet_dpi) {
                tagAlarmsImages.push(tagsIconPath + 'helmet_dpi_24.png');
            }
            if (tag.belt_dpi) {
                tagAlarmsImages.push(tagsIconPath + 'belt_dpi_24.png');
            }
            if (tag.glove_dpi) {
                tagAlarmsImages.push(tagsIconPath + 'glove_dpi_24.png');
            }
            if (tag.shoe_dpi) {
                tagAlarmsImages.push(tagsIconPath + 'shoe_dpi_24.png');
            }
            if (tag.man_down_disabled) {
                tagAlarmsImages.push(tagsIconPath + 'man-down-disabled_24.png');
            }
            if (tag.man_down_tacitated) {
                tagAlarmsImages.push(tagsIconPath + 'man-down-tacitated_24.png');
            }
            if (tag.man_in_quote) {
                tagAlarmsImages.push(tagsIconPath + 'man_in_quote_24.png');
            }
            if (tag.call_me_alarm) {
                tagAlarmsImages.push(tagsIconPath + 'call_me_alarm_24.png');
            }

            return tagAlarmsImages;
        };

        //calculating the distance of the tag from the location center
        service.getTagDistanceFromLocationOrigin = (tag, origin) => {

            let distX = Math.abs(tag.gps_north_degree - origin[0]);
            let distY = Math.abs(tag.gps_east_degree - origin[1]);

            return Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2));
        };

        //function that control if the tag is indoor
        service.isOutdoor = (tag) => {
            return tag.gps_north_degree !== 0 && tag.gps_east_degree !== 0;
        };

        //function that control if the tag is indoor
        service.isOutdoorWithoutLocation = (tag) => {
            return tag.gps_north_degree === -2 && tag.gps_east_degree === -2;
        };

        service.goHome = () => {
            $state.go('home');
        };

        //check if there is at least a tag with an alarm
        service.checkTagsStateAlarmNoAlarmOffline = function (tags) {
            let tagState = {
                withAlarm   : false,
                withoutAlarm: false,
                offline     : false
            };

            tags.forEach(function (tag) {
                if (tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                    || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                    || tag.call_me_alarm || tag.diagnostic_request || tag.inside_zone) {
                    tagState.withAlarm = true;
                } else if (((tag.tag_type_id === 1 || tag.tag_type_id === 14) && tag.is_exit && !tag.radio_switched_off) || (tag.tag_type_id !== 1 && tag.tag_type_id !== 14 && !tag.radio_switched_off && (new Date(Date.now()) - (new Date(tag.time)) > tag.sleep_time_indoor))) {
                    tagState.offline = true;
                } else {
                    tagState.withoutAlarm = true;
                }
            });

            return tagState;
        };

        //controlling the alarms and setting the alarm icon
        service.assigningTagImage = (tag, image) => {
            if (tag.sos) {
                image.src = tagsIconPath + 'sos_24.png';
            } else if (tag.man_down) {
                image.src = tagsIconPath + 'man_down_24.png';
            } else if (tag.battery_status) {
                image.src = tagsIconPath + 'battery_low_24.png';
            } else if (tag.helmet_dpi) {
                image.src = tagsIconPath + 'helmet_dpi_24.png';
            } else if (tag.belt_dpi) {
                image.src = tagsIconPath + 'belt_dpi_24.png';
            } else if (tag.glove_dpi) {
                image.src = tagsIconPath + 'glove_dpi_24.png';
            } else if (tag.shoe_dpi) {
                image.src = tagsIconPath + 'shoe_dpi_24.png';
            } else if (tag.man_down_disabled) {
                image.src = tagsIconPath + 'man_down_disabled_24.png';
            } else if (tag.man_down_tacitated) {
                image.src = tagsIconPath + 'man_down_tacitated_24.png';
            } else if (tag.man_in_quote) {
                image.src = tagsIconPath + 'man_in_quote_24.png';
            } else if (tag.call_me_alarm) {
                image.src = tagsIconPath + 'call_me_alarm_24.png';
            } else {
                image.src = tagsIconPath + 'online_tag_24.png';
            }
        };

        //loading all the images to be shown on the canvas asynchronously
        service.loadImagesAsynchronouslyWithPromise = (data, image) => {
            //if no data is passed resolving the promise with a null value

            if (data.length === 0) {
                return Promise.resolve(null);
            } else {
                //loading all the images asynchronously
                return Promise.all(
                    data.map(function (value) {
                        return new Promise(function (resolve) {
                            let img = new Image();

                            if (image === 'anchor' && !value.is_offline)
                                img.src = tagsIconPath + image + '_online_16.png';
                            else if (image === 'anchor' && value.is_offline)
                                img.src = tagsIconPath + image + '_offline_16.png';
                            else if (image === 'camera')
                                img.src = tagsIconPath + image + '_online_24.png';
                            else if (image === 'tag') {

                                //controling if is a cloud or a isolatedTags tag
                                if (value.length > 1) {
                                    let tagState = service.checkTagsStateAlarmNoAlarmOffline(value);

                                    if (tagState.withAlarm && tagState.withoutAlarm && tagState.offline) {
                                        img.src = tagsIconPath + 'cumulative_tags_all_32.png'
                                    } else if (tagState.withAlarm && tagState.withoutAlarm && !tagState.offline) {
                                        img.src = tagsIconPath + 'cumulative_tags_half_alert_32.png';
                                    } else if (tagState.withAlarm && !tagState.withoutAlarm && !tagState.offline) {
                                        img.src = tagsIconPath + 'cumulative_tags_all_alert_32.png'
                                    } else if (tagState.withAlarm && !tagState.withoutAlarm && tagState.offline) {
                                        img.src = tagsIconPath + 'cumulative_tags_offline_alert_32.png'
                                    } else if (!tagState.withAlarm && tagState.withoutAlarm && tagState.offline) {
                                        img.src = tagsIconPath + 'cumulative_tags_offline_online_32.png'
                                    } else if (!tagState.withAlarm && !tagState.withoutAlarm && tagState.offline) {
                                        img.src = tagsIconPath + 'cumulative_tags_offline_32.png'
                                    } else if (!tagState.withAlarm && tagState.withoutAlarm && !tagState.offline) {
                                        img.src = tagsIconPath + 'cumulative_tags_32.png'
                                    }
                                } else {
                                    if (service.checkIfTagHasAlarm(value)) {
                                        service.assigningTagImage(value, img);
                                    } else if ((value.tag_type_id === 1 || value.tag_type_id === 14) && value.is_exit && !value.radio_switched_off) {
                                        img.src = tagsIconPath + 'offline_tag_24.png';
                                    } else if (value.tag_type_id !== 1 && value.tag_type_id !== 14 && !value.radio_switched_0ff && (new Date(Date.now()) - (new Date(value.time)) > value.sleep_time_indoor)) {
                                        img.src = tagsIconPath + 'offline_tag_24.png';
                                    } else if (!(value.is_exit && value.radio_switched_off)) {
                                        service.assigningTagImage(value, img);
                                    } else {
                                        img.src = tagsIconPath + 'online_tag_24.png';
                                    }
                                }
                            }

                            img.onload = function () {
                                resolve(img);
                            }
                        })
                    })
                )
            }
        };

        service.getTagsLocation = async (tags, locations, userLocations) => {
            console.log(locations);
            console.log(userLocations);
            let alarms = [];
            let tagAlarms = [];

            for (let i = 0; i < tags.length; i++) {

                if (!service.isOutdoor(tags[i])) {
                    await socketService.sendRequest('get_indoor_tag_location', {tag: tags[i].id})
                        .then((response) => {
                            if (response.result.session_state)
                                window.location.reload();

                            console.log(response);
                            if (response.result.name !== undefined)
                                tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, response.result.name);
                            else
                                tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, lang.noLocation);
                        })
                }else{
                    let someResult = locations.filter(l => service.getTagDistanceFromLocationOrigin(tags[i], [l.latitude, l.longitude]) <= l.radius);
                    if (someResult.length !== 0 && userLocations !== undefined && userLocations.some(l => l.name === someResult[0].name)){
                        console.log('is use location')
                        tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, someResult[0].name);
                    } else {
                        tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, lang.noLocation);
                    }
                }

                alarms.push(tagAlarms);
                tagAlarms = [];
            }

            return alarms;
        };

        service.getOutdoorTagLocation = (locations, tag) => {
            return locations.filter( l => service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) < l.radius);
        };

        //getting the tags that are in an outdoor location passed as parameter
        service.getOutdoorLocationsTags = (markers, allTags) => {
            let locationTags = [];
            let locationsTags = [];

            markers.forEach((marker) => {
                if (!marker.is_inside) {
                    allTags.forEach((tag) => {
                        if (service.getTagDistanceFromLocationOrigin(tag, marker.position) <= marker.radius) {
                            locationTags.push(tag.name);
                        }
                    });
                    locationsTags.push({location: marker.name, tags: locationTags.length})
                    locationTags = [];
                }
            });

            return locationsTags;
        };

        service.isElementAtClick = (virtualTagPosition, mouseDownCoords, distance) => {
            return ((virtualTagPosition.width - distance) < mouseDownCoords.x && mouseDownCoords.x < (virtualTagPosition.width + distance)) && ((virtualTagPosition.height - distance) < mouseDownCoords.y && mouseDownCoords.y < (virtualTagPosition.height + distance));
        };

        service.isTagOffline = (tag) => {
            return (tag.is_exit && tag.radio_switched_off);
        };

        service.showAlarms = () => {}
    }

    /**
     * Function thai initialize a websocket chanel
     * @type {Array}
     */
    socketService.$inject = ['$state'];

    function socketService($state) {
        let service = this;
        service.socketClosed     = false;
        let server               = new WebSocket('ws://localhost:8090');
        let serializedSocket = new WebSocket('ws://localhost:8090');

        service.getSocket = () => {
            return serializedSocket;
        };

        let isConstantOpen = false;

        serializedSocket.onopen = function () {
            isConstantOpen = true;
        };

        serializedSocket.onerror = function () {
            console.error('error on connection')
        };

        serializedSocket.onerror = function() {
            $state.go('login');
            service.socketClosed = true;
        };

        let isOpen = false;

        service.floor = {
            defaultFloor: 1
        };

        server.onopen = function () {
            isOpen = true;
        };

        server.onclose = () => {
            $state.go('login');
            service.socketClosed = true;
        };

        service.sendRequest = (action, data) => {
            return new Promise(function (resolve, reject) {

                if (isOpen) {
                    server.send(encodeRequest(action, data));
                    server.onmessage = function (message) {
                        resolve(JSON.parse(message.data));
                    };
                }

                server.onopen = function () {
                    server.send(encodeRequest(action, data));
                    server.onmessage = function (message) {
                        resolve(JSON.parse(message.data));
                        isOpen = true;
                    };
                };

                server.onerror = function (error) {
                    reject(error);
                }
            });
        };
    }

    newSocketService.$inject = ['$state'];
    function newSocketService($state) {
        let service              = this;
        let id = 0;
        service.server               = socketServer;
        service.callbacks = [];

        service.getData = (action, data, callback) => {
            let stringifyedData = JSON.stringify({action: action, data: data});
            if (socketOpened) {
                service.server.send(stringifyedData);
                service.callbacks.push({id: id, value: callback});
            }

            service.server.onmessage = (response) => {
                let result = JSON.parse(response.data);
                let call = service.callbacks.shift();
                call.value(result);
            };

            service.server.onerror = (error) => {
                let call = service.callbacks.shift();
                call.value('error');
            }
        };
    }

    /**
     * Function that handles the recover password requests
     * @type {string[]}
     */
    recoverPassService.$inject = ['$http'];

    function recoverPassService($http) {
        let service = this;

        service.recoverPassword = (email) => {
            return $http({
                method: 'POST',
                url   : mainPath + 'php/server/ajax/recover_password.php',
                params: {email: email}
            })
        };

        service.resetPassword = (code, username, password, repassword) => {
            return $http({
                method: 'POST',
                url   : mainPath + 'php/server/ajax/reset_password.php',
                params: {code: code, username: username, password: password, repassword: repassword}
            })
        }
    }
})();
