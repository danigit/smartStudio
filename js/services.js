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


        service.username             = '';
        service.location             = '';
        service.locationFromClick    = '';
        service.isAdmin              = '';
        service.defaultFloorName     = '';
        service.tags                 = [];
        service.floorTags            = [];
        service.anchors              = [];
        service.floors               = [];
        service.userFloors           = [];
        service.cameras              = [];
        service.alarmsSounds         = [];
        service.dynamicTags          = [];
        service.updateMapTimer       = null;
        service.canvasInterval       = undefined;
        service.mapInterval          = undefined;
        service.userInterval          = undefined;
        service.playAlarm            = true;
        service.isSearchingTag       = false;
        service.offlineTagsIsOpen    = false;
        service.offlineAnchorsIsOpen = false;

        service.loadUserSettings = () => {
            console.log(service.username);
            socketService.sendRequest('get_user_settings', {username: service.username})
                .then((response) => {
                    console.log(response);
                    service.switch = {
                        showGrid      : (response.result[0].grid_on === 1),
                        showAnchors   : (response.result[0].anchors_on === 1),
                        showCameras   : (response.result[0].cameras_on === 1),
                        playAudio: (response.result[0].sound_on === 1),
                        showRadius    : true,
                    };
                    console.log(service.switch);
                })
        };

        service.updateUserSettings = () => {
            let data = {grid_on: service.switch.showGrid, anchors_on: service.switch.showAnchors, cameras_on: service.switch.showCameras, sound_on: service.switch.playAudio};
            let stringifyData = JSON.stringify(data);
            socketService.sendRequest('update_user_settings', {username: service.username, data: stringifyData})
                .then((response) => {
                    console.log(response);
                    service.loadUserSettings();
                })
        };


        //function that show the offline tags
        service.showOfflineTags = (isOutside, constantUpdateNotifications) => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor_offline_tags_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'socketService', 'dataService', function ($scope, socketService, dataService) {
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
                    $scope.labels = ["Tags disativati", "Tag attivi", "Tag spenti", "Tag dispersi"];

                    let interval = undefined;
                    interval     = $interval(function () {
                        socketService.sendConstantAlertRequest('get_all_tags', {
                            user: dataService.username
                        })
                        .then((response) => {
                            let offgridTagsIndoor  = response.result.filter(t => (t.gps_north_degree === 0 && t.gps_east_degree === 0) && (t.type_id !== 1 && t.type_id !== 14) && ((Date.now() - new Date(t.time)) > t.sleep_time_indoor));
                            let offgridTagsOutdoor = response.result.filter(t => (t.gps_north_degree !== 0 && t.gps_east_degree !== 0) && ((Date.now() - new Date(t.gps_time)) > t.sleep_time_outdoor));

                            $scope.offTags = response.result.filter(t => (t.type_id === 1 || t.type_id === 14) && (t.is_exit && t.radio_switched_off));
                            $scope.tagsStateIndoor.offTags = $scope.offTags.length;

                            let tempOffgrid = [];
                            offgridTagsIndoor.forEach(elem => {
                                tempOffgrid.push(elem);
                            });

                            offgridTagsOutdoor.forEach(elem => {
                                tempOffgrid.push(elem);
                            });

                            $scope.offlineTagsIndoor       = response.result.filter(t => (t.is_exit && !t.radio_switched_off));
                            $scope.offgridTags             = tempOffgrid;
                            $scope.tagsStateIndoor.offline = $scope.offlineTagsIndoor.length;
                            $scope.tagsStateIndoor.online  = response.result.length - $scope.offlineTagsIndoor.length - (offgridTagsIndoor.length + offgridTagsOutdoor.length) - $scope.offTags.length;
                            $scope.tagsStateIndoor.offgrid = offgridTagsIndoor.length + offgridTagsOutdoor.length;

                            $scope.data = [$scope.tagsStateIndoor.offline, $scope.tagsStateIndoor.online, $scope.tagsStateIndoor.offTags, $scope.tagsStateIndoor.offgrid];
                        })
                        .catch((error) => {
                            console.log('showOfllineTags error => ', error);
                        });

                        if (angular.element(document).find('md-dialog').length === 0) {
                            $interval.cancel(interval);
                            if (!isOutside)
                                constantUpdateNotifications();
                        }
                    }, 1000);

                    $scope.hide = () => {
                        $mdDialog.hide();
                        $interval.cancel(interval);
                        if (!isOutside)
                            constantUpdateNotifications();
                    }
                }]
            });
        };

        //checking if there is at least one tag offline
        service.checkIfTagsAreOffline = (tags) => {
            return tags.some(function (tag) {
                return tag.is_exit && !tag.radio_switched_off;
            })
        };

        //checking if there is at least an anchor offline
        service.checkIfAnchorsAreOffline = (anchors) => {
            return anchors.some(function (anchor) {
                return anchor.is_online !== true;
            });
        };

        //showing the info window with the online/offline anchors
        service.showOfflineAnchors = (isOutside, constantUpdateNotifications) => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor_offline_anchors_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'dataService', 'socketService', function ($scope, dataService, socketService) {

                    $scope.offlineAnchors = [];
                    $scope.data           = [];

                    $scope.anchorsState = {
                        offline: 0,
                        online : 0
                    };

                    $scope.colors = ["#D3D3D3", "#4BAE5A"];
                    $scope.labels = ["Ancore disativate", "Ancore attive"];

                    let interval = undefined;
                    interval     = $interval(function () {
                        socketService.sendConstantAlertRequest('get_anchors_by_user', {
                            user: dataService.username
                        })
                        .then((response) => {

                            $scope.offlineAnchors = response.result.filter(a => !a.is_online);

                            $scope.anchorsState.offline = $scope.offlineAnchors.length;
                            $scope.anchorsState.online  = response.result.length - $scope.offlineAnchors.length;

                            $scope.data = [$scope.anchorsState.offline, $scope.anchorsState.online];
                        })
                        .catch((error) => {
                            console.log('showOfflineAnchors error => ', error);
                        });

                        if (angular.element(document).find('md-dialog').length === 0) {
                            $interval.cancel(interval);
                            if (!isOutside)
                                constantUpdateNotifications();
                        }
                    }, 1000);


                    $scope.hide = () => {
                        $mdDialog.hide();
                        $interval.cancel(interval);
                        if (!isOutside)
                            constantUpdateNotifications();
                    }
                }]
            })
        };

        //creating the informations to be shown on the info window of the canvas objects
        service.createAlarmObjectForInfoWindow = (tag, name, description, image) => {
            return {
                tag        : tag.name,
                name       : name,
                description: description,
                image      : image
            };
        };

        //function that control if the tag is indoor
        service.isOutdoor = (tag) => {
            return tag.gps_north_degree !== 0 && tag.gps_east_degree !== 0;
        };

        service.getAllLocations = () => {
            return socketService.sendRequest('get_all_locations');
        };

        service.isTagInLocation = (tag, location) => {
            return service.getTagDistanceFromLocationOrigin(tag, location.position) <= location.radius;
        };

        //getting all the alarms of the tag passed as parameter and creating the objects to be shown in info window
        service.loadTagAlarmsForInfoWindow = (tag, locations) => {
            let alarms = [];

            if (tag.sos) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, 'SOS', 'Richiesta di aiuto.', tagsIconPath + 'sos_24.png'));
            }
            if (tag.man_down) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Uomo a terra', 'Uomo a terra.', tagsIconPath + 'man_down_24.png'));
            }
            if (tag.battery_status) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Batteria scarica', 'La batteria e\' scarica.', tagsIconPath + 'battery_low_24.png'));
            }
            if (tag.helmet_dpi) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Helmet dpi', 'Helmet dpi', tagsIconPath + 'helmet_dpi_24.png'));
            }
            if (tag.belt_dpi) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Belt dpi', 'Belt dpi', tagsIconPath + 'belt_dpi_24.png'));
            }
            if (tag.glove_dpi) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Glove dpi', 'Glove dpi', tagsIconPath + 'glove_dpi_24.png'));
            }
            if (tag.shoe_dpi) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Shoe dpi', 'Shoe dpi', tagsIconPath + 'shoe_dpi_24.png'));
            }
            if (tag.man_down_disabled) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Man down disabled', 'Man down disabled', tagsIconPath + 'man_down_disbled_24.png'));
            }
            if (tag.man_down_tacitated) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, 'man down tacitated', 'Man down tacitated', tagsIconPath + 'man_down_tacitated_24.png'));
            }
            if (tag.man_in_quote) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Man in quote', 'Man in quote', tagsIconPath + 'man_in_quote_24.png'));
            }
            if (tag.call_me_alarm) {
                alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Call me alarm', 'Call me alarm', tagsIconPath + 'call_me_alarm_24.png'));
            }
            if (service.isOutdoor(tag)){
                let isInLocation = locations.some(l => service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) < l.radius);
                if (!isInLocation){
                    alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Tag fuori sito', "Il tag e' fuori da tutti i siti", tagsIconPath + 'tag_out_of_location_24.png'));
                }
            }
            return alarms;
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
                    || tag.call_me_alarm || tag.diagnostic_request;
            })
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

            if (service.alarmsSounds.length > 1 && service.playAlarm && service.switch.playAudio) {
                audio = new Audio(audioPath + 'sndMultipleAlarm.mp3');
                audio.play();
                service.playAlarm = false;
            } else {
                if (controlIfArrayHasAlarm(service.alarmsSounds, 'battery') && service.playAlarm && service.switch.playAudio) {
                    audio = new Audio(audioPath + 'sndBatteryAlarm.mp3');
                    audio.play();
                }
                if (controlIfArrayHasAlarm(service.alarmsSounds, 'mandown') && service.playAlarm && service.switch.playAudio) {
                    audio = new Audio(audioPath + 'sndManDownAlarm.mp3');
                    audio.play();
                }
                if (controlIfArrayHasAlarm(service.alarmsSounds, 'sos') && service.playAlarm && service.switch.playAudio) {
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
                tagAlarmsImages.push(tagsIconPath + 'man-down-disabled.png');
            }
            if (tag.man_down_tacitated) {
                tagAlarmsImages.push(tagsIconPath + 'man-down-tacitated.png');
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

        service.goHome = () => {
            $state.go('home');
        }
    }

    /**
     * Function thai initialize a websocket chanel
     * @type {Array}
     */
    socketService.$inject = ['$state'];

    function socketService($state) {
        let service              = this;
        service.socketClosed     = false;
        let server               = new WebSocket('ws://localhost:8090');
        let constantUpdateSocket = new WebSocket('ws://localhost:8090');
        let constantAlertSocket  = new WebSocket('ws://localhost:8090');

        let isConstantAlertOpen = false;

        constantAlertSocket.onopen = function () {
            isConstantAlertOpen = true;
        };

        constantAlertSocket.onerror = function () {
            console.log('error on connection')
        };

        let isConstantOpen = false;

        constantUpdateSocket.onopen = function () {
            isConstantOpen = true;
        };

        constantUpdateSocket.onerror = function () {
            console.log('error on connection')
        };

        let isOpen = false;

        service.floor = {
            defaultFloor: 1
        };

        server.onopen = function () {
            isOpen = true;
        };

        server.onerror = function () {
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

        service.sendConstantAlertRequest = (action, data) => {
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
                        isConstantAlertOpen = true;
                    };
                };

                server.onerror = function (error) {
                    reject(error);
                }
            });
        };

        service.sendConstantRequest = (action, data) => {
            return new Promise(function (resolve, reject) {

                if (isConstantOpen) {
                    constantUpdateSocket.send(encodeRequest(action, data));
                    constantUpdateSocket.onmessage = function (message) {
                        resolve(JSON.parse(message.data));
                    }
                }

                constantUpdateSocket.onopen = function () {
                    constantUpdateSocket.send(encodeRequest(action, data));
                    constantUpdateSocket.onmessage = function (message) {
                        resolve(JSON.parse(message.data));
                        isConstantOpen = true;
                    }
                };

                constantUpdateSocket.onerror = function (error) {
                    reject(error);
                }
            })
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
                url   : mainPath + 'php/ajax/recover_password.php',
                params: {email: email}
            })
        };

        service.resetPassword = (code, username, password, repassword) => {
            return $http({
                method: 'POST',
                url   : mainPath + 'php/ajax/reset_password.php',
                params: {code: code, username: username, password: password, repassword: repassword}
            })
        }
    }
})();
