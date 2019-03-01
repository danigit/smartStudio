(function () {
    'use strict';

    //reloading angular module
    let main = angular.module('main');


    //SERVICES
    main.service('dataService', dataService);
    main.service('recoverPassService', recoverPassService);
    main.service('socketService', socketService);

    dataService.$inject = ['$mdDialog', '$interval'];
    function dataService($mdDialog, $interval){
        let service = this;


        service.username = '';
        service.location = '';
        service.locationFromClick = '';
        service.isAdmin = '';
        service.tags = [];
        service.defaultFloorName = '';
        service.floorTags = [];
        service.anchors = [];
        service.floors = [];
        service.userFloors = [];
        service.cameras = [];
        service.canvasInterval = undefined;
        service.playAlarm = true;
        service.alarmsSounds = [];

        service.showOfflineTags = function () {
            $mdDialog.show({
                templateUrl        : '../SMARTSTUDIO/components/indoor_offline_tags_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'socketService', 'dataService', function ($scope, socketService, dataService) {

                    $scope.offlineTagsIndoor = [];
                    $scope.data              = [];

                    $scope.tagsStateIndoor = {
                        offline: 0,
                        online : 0
                    };

                    $scope.colors = ["#D3D3D3", "#4BAE5A"];
                    $scope.labels = ["Tags disativati", "Tag attivi"];

                    let interval = undefined;
                    interval     = $interval(function () {
                        socketService.sendRequest('get_tags_by_user', {
                            user: dataService.username
                        })
                            .then(function (response) {
                                console.log(response.result);
                                $scope.offlineTagsIndoor = response.result.filter(t => (t.is_exit && !t.radio_switched_off));

                                $scope.tagsStateIndoor.offline = $scope.offlineTagsIndoor.length;
                                $scope.tagsStateIndoor.online  = response.result.length - $scope.offlineTagsIndoor.length;

                                $scope.data = [$scope.tagsStateIndoor.offline, $scope.tagsStateIndoor.online];
                            })
                    }, 1000);

                    $scope.hide = function () {
                        $mdDialog.hide();
                        $interval.cancel(interval);
                    }
                }]
            })
        };

        //checking if there is at least an anchor offline
        service.checkIfAnchorsAreOffline = function (anchors) {
            return anchors.some(function (anchor) {
                return anchor.is_online !== true;
            });
        };

        //showing the info window with the online/offline anchors
        service.showOfflineAnchors = function () {
            $mdDialog.show({
                templateUrl        : '../SMARTSTUDIO/components/indoor_offline_anchors_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'dataService', 'socketService', function ($scope, dataService, socketService) {

                    $scope.offlineAnchors = [];
                    $scope.data = [];

                    $scope.anchorsState = {
                        offline: 0,
                        online : 0
                    };

                    $scope.colors = ["#D3D3D3", "#4BAE5A"];
                    $scope.labels = ["Ancore disativate", "Ancore attive"];

                    let interval = undefined;
                    interval     = $interval(function () {
                        socketService.sendRequest('get_anchors_by_user', {
                            user: dataService.username
                        })
                            .then(function (response) {

                                $scope.offlineAnchors = response.result.filter(a => !a.is_online);

                                $scope.anchorsState.offline = $scope.offlineAnchors.length;
                                $scope.anchorsState.online  = response.result.length - $scope.offlineAnchors.length;

                                $scope.data = [$scope.anchorsState.offline, $scope.anchorsState.online];
                            })
                    }, 1000);


                    $scope.hide = function () {
                        $mdDialog.hide();
                        $interval.cancel(interval);
                    }
                }]
            })
        };

        //creating the informations to be shown on the info window of the canvas objects
        service.createAlarmObjectForInfoWindow = function (tag, name, description, image) {
            return {
                tag        : tag.name,
                name       : name,
                description: description,
                image      : image
            };
        };

        //getting all the alarms of the tag passed as parameter and creating the objects to be shown in info window
        service.loadTagAlarmsForInfoWindow = function (tag) {
            let alarms = [];

            if (tag.sos) {
                alarms.push(service.createAlarmObjectForInfoWindow({tag: tag, name: 'SOS', description: 'Richiesta di aiuto.', image: tagsIconPath + 'sos_24.png'}));
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

            return alarms;
        };

        let controlIfAlarmIsInArray = function (alarms, tag, alarmType) {
            let result = false;
            alarms.forEach(function (alarm) {
                if (alarm.tag === tag && alarm.alarm === alarmType)
                    result = true

            });

            return result;
        };

        let controlIfArrayHasAlarm = function (alarms, alarmType) {
            let result = false;
            alarms.forEach(function (alarm) {
                if (alarm.alarm === alarmType)
                    result = true
            });

            return result;
        };

        let filterAlarms = function (alarms, tag, alarmType) {
            let resultAlarms = [];
            alarms.forEach(function (alarm) {
                if (alarm.tag === tag && alarm.alarm === alarmType) {
                    console.log('found element in alarms');
                } else {
                    resultAlarms.push(alarm);
                }
            });

            return resultAlarms;
        };

        service.playAlarmsAudio = function (tags) {
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

            if (service.alarmsSounds.length > 1 && service.playAlarm) {
                audio = new Audio(audioPath + 'sndMultipleAlarm.mp3');
                audio.play();
                service.playAlarm = false;
            } else {
                if (controlIfArrayHasAlarm(service.alarmsSounds, 'battery') && service.playAlarm) {
                    audio = new Audio(audioPath + 'sndBatteryAlarm.mp3');
                    audio.play();
                }
                if (controlIfArrayHasAlarm(service.alarmsSounds, 'mandown') && service.playAlarm) {
                    audio = new Audio(audioPath + 'sndManDownAlarm.mp3');
                    audio.play();
                }
                if (controlIfArrayHasAlarm(service.alarmsSounds, 'sos') && service.playAlarm) {
                    audio = new Audio(audioPath + 'indila-sos.mp3');
                    audio.play();
                }
                service.playAlarm = false;
            }
        };
    }

    /**
     * Function thai initialize a websocket chanel
     * @type {Array}
     */
    socketService.$inject = [];
    function socketService(){
        let service = this;

        let server = new WebSocket('ws://localhost:8090');
        let constantUpdateSocket = new WebSocket('ws://localhost:8090');

        let isConstantOpen = false;

        constantUpdateSocket.onopen = function(){
            isConstantOpen = true;
        };

        constantUpdateSocket.onerror = function(){
            console.log('error on connection')
        }

        let isOpen = false;

        service.floor = {
            defaultFloor: 1
        };

        server.onopen = function(){
            isOpen = true;
        };

        server.onerror = function(){
        };

        service.sendRequest = function(action, data){
            return new Promise(function (resolve, reject) {

                if (isOpen) {
                    server.send(encodeRequest(action, data));
                    server.onmessage = function (message) {
                        resolve(JSON.parse(message.data));
                    }
                }

                server.onopen = function () {
                    server.send(encodeRequest(action, data));
                    server.onmessage = function(message) {
                        resolve(JSON.parse(message.data));
                        isOpen = true;
                    }
                };

                server.onerror = function (error) {
                    reject(error);
                }
            })
        };

        service.sendConstantRequest = function(action, data){
            return new Promise(function (resolve, reject) {

                if (isConstantOpen) {
                    constantUpdateSocket.send(encodeRequest(action, data));
                    constantUpdateSocket.onmessage = function (message) {
                        resolve(JSON.parse(message.data));
                    }
                }

                constantUpdateSocket.onopen = function () {
                    constantUpdateSocket.send(encodeRequest(action, data));
                    constantUpdateSocket.onmessage = function(message) {
                        resolve(JSON.parse(message.data));
                        isOpen = true;
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

        service.recoverPassword = function (email) {
            return $http({
                method: 'POST',
                url: mainPath + 'php/ajax/recover_password.php',
                params: {email: email}
            })
        };

        service.resetPassword = function (code, username, password, repassword) {
            return $http({
                method: 'POST',
                url: mainPath + 'php/ajax/reset_password.php',
                params: {code: code, username: username, password: password, repassword: repassword}
            })
        }
    }
})();
