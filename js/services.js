(function () {
    'use strict';

    //reloading angular module
    let main = angular.module('main');


    //SERVICES
    main.service('dataService', dataService);
    main.service('recoverPassService', recoverPassService);
    main.service('socketService', socketService);

    dataService.$inject = ['$mdDialog', '$interval', '$state', 'socketService'];

    function dataService($mdDialog, $interval, $state, socketService) {
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

        service.loadUserSettings = () => {
            let id = ++requestId;
            socket.send(encodeRequestWithId(id, 'get_user_settings', {username: service.user.username}));
            socket.onmessage = (response) => {
                let parsedResponse = parseResponse(response);
                if (parsedResponse.id === id){
                    if(parsedResponse.result.length !== 0) {
                        service.switch = {
                            showGrid   : (parsedResponse.result[0].grid_on === 1),
                            showAnchors: (parsedResponse.result[0].anchors_on === 1),
                            showCameras: (parsedResponse.result[0].cameras_on === 1),
                            showOutrangeTags: (parsedResponse.result[0].outag_on === 1),
                            showOutdoorTags: (parsedResponse.result[0].outdoor_tag_on === 1),
                            showZones: (parsedResponse.result[0].zones_on === 1),
                            playAudio  : (parsedResponse.result[0].sound_on === 1),
                            showRadius : true,
                            showOutdoorRectDrawing: false,
                            showOutdoorRoundDrawing: false
                        };
                    }
                }
            };
        };

        service.updateUserSettings = () => {
            console.log(service.switch)
            let data = {grid_on: service.switch.showGrid, anchors_on: service.switch.showAnchors, cameras_on: service.switch.showCameras, outag_on: service.switch.showOutrangeTags, outdoor_tag_on: service.switch.showOutdoorTags, zones_on: service.switch.showZones, sound_on: service.switch.playAudio};
            let stringifyData = JSON.stringify(data);
            let id = ++requestId;

            socket.send(encodeRequestWithId(id, 'update_user_settings', {username: service.user.username, data: stringifyData}));
            socket.onmessage = (response) => {
                let parsedResponse = parseResponse(response);
                if (parsedResponse.id === id){
                    service.loadUserSettings();
                }
            };
        };


        //function that show the offline tags
        service.showOfflineTags = (position, constantUpdateNotifications, map) => {
            if (service.updateMapTimer !== undefined){
                $interval.cancel(service.updateMapTimer);
                service.updateMapTimer = undefined;
            }
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor_offline_tags_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', '$controller', 'socketService', 'dataService', function ($scope, $controller, socketService, dataService) {
                    $controller('languageController', {$scope: $scope});
                    $scope.offlineTagsIndoor = [];
                    $scope.offgridTags       = [];
                    $scope.offTags       = [];
                    $scope.data              = [];

                    $scope.tagsStateIndoor = {
                        offline: 0,
                        online : 0,
                        offgrid: 0,
                        offTags: 0
                    };

                    $scope.colors = ["#D3D3D3", "#4BAE5A", "#E12315", "#F76E41"];
                    $scope.labels = [lang.disabledTags, lang.activeTags, lang.shutDownTags, lang.lostTags];

                    service.offlineTagsInterval     = $interval(function () {
                        let id = ++requestId;
                        socket.send(encodeRequestWithId(id, 'get_all_tags'));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id) {
                                let offgridTagsIndoor  = parsedResponse.result.filter(t => (t.gps_north_degree === 0 && t.gps_east_degree === 0) && (t.type_id !== 1 && t.type_id !== 14) && ((Date.now() - new Date(t.time)) > t.sleep_time_indoor));
                                let offgridTagsOutdoor = parsedResponse.result.filter(t => (t.gps_north_degree !== 0 && t.gps_east_degree !== 0) && ((Date.now() - new Date(t.gps_time)) > t.sleep_time_outdoor));

                                let tempOffTags = parsedResponse.result.filter(t => (t.type_id === 1 || t.type_id === 14) && (t.is_exit && t.radio_switched_off));

                                if (!angular.equals(tempOffTags, $scope.offTags)){
                                    $scope.offTags = tempOffTags;
                                }

                                $scope.tagsStateIndoor.offTags = $scope.offTags.length;

                                let tempOffgrid = [];
                                offgridTagsIndoor.forEach(elem => {
                                    tempOffgrid.push(elem);
                                });

                                offgridTagsOutdoor.forEach(elem => {
                                    tempOffgrid.push(elem);
                                });

                                if (!angular.equals(tempOffgrid, $scope.offgridTags)){
                                    $scope.offgridTags             = tempOffgrid;
                                }
                                let tempOfflineTagsIndoor = parsedResponse.result.filter(t => (t.is_exit && !t.radio_switched_off));
                                if (!angular.equals(tempOfflineTagsIndoor, $scope.offlineTagsIndoor)){
                                    $scope.offlineTagsIndoor       = tempOfflineTagsIndoor;
                                }
                                $scope.tagsStateIndoor.offline = $scope.offlineTagsIndoor.length;
                                $scope.tagsStateIndoor.online  = parsedResponse.result.length - $scope.offlineTagsIndoor.length - (offgridTagsIndoor.length + offgridTagsOutdoor.length) - $scope.offTags.length;
                                $scope.tagsStateIndoor.offgrid = offgridTagsIndoor.length + offgridTagsOutdoor.length;

                                $scope.data = [$scope.tagsStateIndoor.offline, $scope.tagsStateIndoor.online, $scope.tagsStateIndoor.offTags, $scope.tagsStateIndoor.offgrid];

                            }
                        };
                    }, 1000);

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function(event, removePromise){
                    if (service.offlineTagsInterval !== undefined) {
                        $interval.cancel(service.offlineTagsInterval);
                        service.offlineTagsInterval = undefined;
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
            });
        };

        //checking if there is at least one tag offline
        service.checkIfTagsAreOffline = (tags) => {
            return tags.some(function (tag) {
                return ((tag.gps_north_degree === 0 && tag.gps_east_degree === 0) && (tag.type_id === 1 || tag.type_id === 14) && (tag.is_exit && !tag.radio_switched_off))
                    || ((tag.gps_north_degree !== 0 && tag.gps_east_degree !== 0) && (((Date.now() - new Date(tag.gps_time)) > tag.sleep_time_outdoor)))
                    || ((tag.gps_north_degree === 0 && tag.gps_east_degree === 0) && (tag.type_id !== 1 && tag.type_id !== 14) && (((Date.now() - new Date(tag.time)) > tag.sleep_time_indoor)));
            })
        };

        //checking if there is at least an anchor offline
        service.checkIfAnchorsAreOffline = (anchors) => {
            return anchors.some(function (anchor) {
                return anchor.is_online !== 1 || anchor.battery_status === 1;
            });
        };

        //checking if there is at least an anchor offline
        service.checkIfAreAnchorsOffline = (anchors) => {
            return anchors.some(function (anchor) {
                return anchor.is_online === 0;
            });
        };

        //showing the info window with the online/offline anchors
        service.showOfflineAnchors = (position, constantUpdateNotifications, map) => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor_offline_anchors_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', '$controller', 'dataService', 'socketService', function ($scope, $controller, dataService, socketService) {
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
                        socket.send(encodeRequestWithId(id, 'get_anchors_by_user', {
                            user: dataService.user.username
                        }));
                        socket.onmessage = (response) => {
                            console.log(response.data);
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id) {
                                let tempOfflineAnchors = parsedResponse.result.filter(a => !a.is_online);

                                if (!angular.equals(tempOfflineAnchors, $scope.offlineAnchors)) {
                                    $scope.offlineAnchors = tempOfflineAnchors;
                                }

                                let tempShutDonwAnchors = parsedResponse.result.filter(a => a.battery_status === 1);

                                if (!angular.equals(tempShutDonwAnchors, $scope.shutDownAnchors)){
                                    $scope.shutDownAnchors = tempShutDonwAnchors;
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
                onRemoving: function(event, removePromise){
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

        //showing the info window with the online/offline anchors
        service.showOfflineAnchorsIndoor = (position, constantUpdateNotifications, map) => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor_offline_anchors_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', '$controller', 'dataService', 'socketService', function ($scope, $controller, dataService, socketService) {
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
                                let tempOfflineAnchors = parsedResponse.result.filter(a => !a.is_online);

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
                onRemoving: function(event, removePromise){
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
                        console.log(response);
                        resolve(response.result);
                    })
            })
        };

        //function that controls if the passed alarm is in the array passed as well as parameter
        let controlIfAlarmIsInArray = (alarms, tag, alarmType) => {
            let result = false;
            alarms.forEach(function (alarm) {
                if (alarm.tag === tag && alarm.alarm === alarmType)
                    result = true

            });

            return result;
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

        //function that filters the alarms by the passed parameter
        let filterAlarms = (alarms, tag, alarmType) => {
            let resultAlarms = [];
            alarms.forEach(function (alarm) {
                if (alarm.tag === tag && alarm.alarm === alarmType) {
                } else {
                    resultAlarms.push(alarm);
                }
            });

            return resultAlarms;
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
            let tagInAllarm = false;
            tags.forEach((tag) => {
                if (service.isOutdoor(tag)){
                    if(tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                        || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                        || tag.call_me_alarm || tag.diagnostic_request){
                        tagInAllarm = true;
                    }
                }
            });

            return tagInAllarm;
        };

        service.checkIfAnchorsHaveAlarms = (anchors) => {
            return anchors.some(a => a.battery_status);
        };

        //function that palay the alarms audio of the tags passed as parameter
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
                } else if (tag.is_exit && !tag.radio_switched_off) {
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

                            if (image === 'anchor' && value.is_online)
                                img.src = tagsIconPath + image + '_online_16.png';
                            else if (image === 'anchor' && !value.is_online)
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
                                    } else if (!tagState.withAlarm && tagState.withoutAlarm && !tagState.offline) {
                                        img.src = tagsIconPath + 'cumulative_tags_32.png'
                                    }
                                } else {
                                    if (service.checkIfTagHasAlarm(value[0])) {
                                        service.assigningTagImage(value[0], img);
                                    } else if (value[0].is_exit && !value[0].radio_switched_off) {
                                        img.src = tagsIconPath + 'offline_tag_24.png';
                                    } else if (!(value[0].is_exit && value[0].radio_switched_off)) {
                                        service.assigningTagImage(value[0], img);
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

        service.getTagsLocation = async (tags, locations, userLocatins) => {
            console.log(locations);
            console.log(userLocatins);
            let alarms = [];
            let tagAlarms = [];

            for (let i = 0; i < tags.length; i++) {

                if (!service.isOutdoor(tags[i])) {
                    await socketService.sendRequest('get_indoor_tag_location', {tag: tags[i].id})
                        .then((response) => {
                            console.log(response);
                            if (response.result.name !== undefined)
                                tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, response.result.name);
                            else
                                tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, 'Nessuna location');
                        })
                }else{
                    console.log(tags[i])
                    let someResult = locations.filter(l => service.getTagDistanceFromLocationOrigin(tags[i], [l.latitude, l.longitude]) <= l.radius);
                    console.log(someResult);
                    if (someResult.length !== 0 && userLocatins.some(l => l.name === someResult[0].name)){
                        console.log('is use location')
                        tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, someResult[0].name);
                    } else {
                        tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, 'Nessuna location');
                    }
                }

                alarms.push(tagAlarms);
            }

            return alarms;
        };

        service.getOutdoorTagLocation = (locations, tag) => {
            return locations.filter( l => service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) < l.radius);
        };

        service.getIndoorLocationTags = async (markers) => {
            let locationInfo = [];
            let locationTags = [];
            let locationAnchors = [];

            for (let i = 0; i < markers.length; i++) {
                if (markers[i].is_inside === 1){
                    await socketService.sendRequest('get_location_tags', {location: markers[i].name})
                        .then((response) => {
                            locationTags.push({location: markers[i].name, tags: response.result.length});

                        });
                    await socketService.sendRequest('get_anchors_by_location', {location: markers[i].name})
                        .then((response) => {
                            locationAnchors.push({location: markers[i].name, anchors: response.result.length})
                        })
                }
            }

            locationInfo.push(locationTags);
            locationInfo.push(locationAnchors);
            return locationInfo;
        };

        service.getOutdoorLocationTags = (markers, allTags) => {
            let locationTags = [];
            let locationsTags = [];

            markers.forEach((marker) => {
                if (marker.is_inside === 0) {
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
        }
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
