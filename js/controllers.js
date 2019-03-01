(function () {
    'use strict';

    //reloading angular module
    let main = angular.module('main');

    //CONTROLLERS
    main.controller('loginController', loginController);
    main.controller('homeController', homeController);
    main.controller('recoverPassController', recoverPassController);
    main.controller('canvasController', canvasController);
    main.controller('outdoorController', outdoorController);
    main.controller('menuController', menuController);

    /**
     * Function that manage the user login functionalities
     * @type {string[]}
     */
    loginController.$inject = ['$scope', 'socketService', '$state'];

    function loginController($scope, socketService, $state) {
        $scope.user           = {username: '', password: ''};
        $scope.errorHandeling = {noConnection: false, wrongData: false};

        // function that makes the log in of the user
        $scope.login = function (form) {
            form.$submitted = 'true';

            socketService.sendRequest('login', {username: $scope.user.username, password: $scope.user.password}).then(
                function (response) {
                    if (response.result !== "ERROR_ON_LOGIN") {
                        $state.go('home');
                    } else {
                        $scope.errorHandeling.noConnection = false;
                        $scope.errorHandeling.wrongData    = true;
                    }
                    $scope.$apply();
                }
            ).catch(
                function () {
                    $scope.errorHandeling.wrongData    = false;
                    $scope.errorHandeling.noConnection = true;
                }
            )
        };

        //change the page to the recover password page
        $scope.recoverPassword = function () {
            $state.go('recover-password');
        }
    }

    /**
     * Function that manges the home page functionalities
     * @type {string[]}
     */
    homeController.$inject = ['$scope', '$state', '$mdDialog', '$interval', 'NgMap', 'homeData', 'socketService', 'dataService'];

    function homeController($scope, $state, $mdDialog, $interval, NgMap, homeData, socketService, dataService) {

        let homeCtrl = this;
        let markers  = homeData.markers;
        let bounds   = null;

        homeCtrl.isAdmin = (homeData.isAdmin === 1);
        homeCtrl.showOfflineTagsIcon = isTagOffline(homeData.tags);

        homeCtrl.mapConfiguration = {
            zoom    : 7,
            map_type: 'TERRAIN',
            center  : [41.87194, 12.56738]
        };

        homeCtrl.dynamicMarkers = [];

        NgMap.getMap('main-map').then(function (map) {
            map.set('styles', [{
                    featureType: "poi",
                    elementType: "labels",
                    stylers    : [
                        {visibility: "off"}
                    ]
                }, {
                    featureType: "water",
                    elementType: "labels",
                    stylers    : [
                        {visibility: "off"}
                    ]
                }, {
                    featureType: "road",
                    elementType: "labels",
                    stylers    : [
                        {visibility: "off"}
                    ]
                }
            ]);

            bounds = new google.maps.LatLngBounds();

            markers.forEach(function (marker, index) {
                let latLng = new google.maps.LatLng(marker.position[0], marker.position[1]);

                let markerObject = new google.maps.Marker({
                    position : latLng,
                    animation: google.maps.Animation.DROP,
                    icon     : '../SMARTSTUDIO/img/icons/markers/' + ((marker.icon) ? marker.icon : 'location-marker.png')
                });

                let infoWindow = new google.maps.InfoWindow({
                    content: '<div class="marker-info-container">' +
                        '<img src="../SMARTSTUDIO/img/icons/login-icon.png" class="tag-info-icon">' +
                        '<p class="text-center font-large font-bold color-darkcyan">' + marker.name.toUpperCase() + '</p>' +
                        '<div><p class="float-left">Latitude: </p><p class="float-right">' + marker.position[0] + '</p></div>' +
                        '<div class="clear-float"><p class="float-left">Longitude: </p><p class="float-right">' + marker.position[1] + '</p></div>' +
                        '</div>'
                });

                markerObject.addListener('mouseover', function () {
                    infoWindow.open(map, this);
                });

                markerObject.addListener('mouseout', function () {
                    infoWindow.close(map, this);
                });

                google.maps.event.addDomListener(markerObject, 'click', function () {
                    socketService.sendRequest('save_location', {location: marker.name})
                        .then(function (response) {
                            if (response.result === 'location_saved') {
                                socketService.sendRequest('get_location_info', {})
                                    .then(function (response) {
                                        dataService.location          = response.result[0];
                                        dataService.defaultFloorName  = '';
                                        dataService.locationFromClick = '';
                                        if (response.result[0].is_inside)
                                            $state.go('canvas');
                                        else
                                            $state.go('outdoor-location');
                                    })
                            }
                        })
                });

                homeCtrl.dynamicMarkers.push(markerObject);
                bounds.extend(markerObject.getPosition());
            });

            homeCtrl.markerClusterer = new MarkerClusterer(map, homeCtrl.dynamicMarkers, {imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});

            //if there are no markers I set the map to italy with zoom 8
            if (homeCtrl.dynamicMarkers.length === 0) {
                let latLng = new google.maps.LatLng(44.44, 8.88);
                map.setCenter(latLng);
                map.setZoom(8);
            }//if there is only a marker I set the map on the marker with zoom 11
            else if (homeCtrl.dynamicMarkers.length === 1) {
                map.setCenter(bounds.getCenter());
                map.setZoom(11);
            }//if the map has more than one marker I let maps to set automatically the zoom
            else {
                map.setCenter(bounds.getCenter());
                map.fitBounds(bounds);
            }
        });

        //showing the info window with the online/offline tags
        homeCtrl.showOfflineTagsHome = function () {
            dataService.showOfflineTags();
        };

        //checking if there is at least one anchor offline
        (function () {
            socketService.sendRequest('get_anchors_by_user', {user: dataService.username})
                .then(function (response) {
                    homeCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(response.result);
                }
            );
        })();

        //showing the info window with the online/offline anchors
        $scope.showOfflineAnchorsHome = function () {
            dataService.showOfflineAnchors();
        };

        let checkIfTagsHaveAlarms = function (tags) {
            return tags.some(function (tag) {
                return tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                    || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                    || tag.call_me_alarm || tag.diagnostic_request;
            })
        };

        homeCtrl.showAlarmsIcon = checkIfTagsHaveAlarms(dataService.tags);

        //showing the info window with all the alarms
        homeCtrl.showAlarmsHome = function () {
            $mdDialog.show({
                locals             : {scope: $scope},
                templateUrl        : '../SMARTSTUDIO/components/indoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'scope', 'socketService', 'dataService', function ($scope, scope, socketService, dataService) {
                    let tags       = null;
                    let floorIndex = 0;
                    $scope.alarms  = [];


                    socketService.sendRequest('get_tags_by_user', {user: dataService.username})
                        .then(function (response) {
                            tags = response.result;
                            response.result.forEach(function (tag) {
                                let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tag);
                                tagAlarms.forEach(function (tagAlarm) {
                                    $scope.alarms.push(tagAlarm);
                                })
                            });
                        });

                    $scope.loadLocation = function (alarm) {
                        let tag = tags.filter(t => t.name === alarm.tag);

                        socketService.sendRequest('save_location', {location: tag[0].location_name})
                            .then(function (response) {
                                dataService.defaultFloorName  = tag[0].floor_name;
                                dataService.locationFromClick = tag[0].location_name;

                                $state.go('canvas');
                                $mdDialog.hide();
                            });
                    };

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        dataService.playAlarmsAudio(homeData.tags);
    }

    /**
     * Function that manages the login map
     * @type {string[]}
     */
    outdoorController.$inject = ['$location', '$scope', '$timeout', '$interval', '$mdDialog', 'NgMap', 'socketService', 'dataService', 'outdoorData'];

    function outdoorController($location, $scope, $timeout, $interval, $mdDialog, NgMap, socketService, dataService, outdoorData) {
        let outdoorCtrl    = this;
        let userTags       = outdoorData.tags;
        let tags           = null;
        let updateMapTimer = null;
        let bounds         = new google.maps.LatLngBounds();
        let locationInfo   = '';

        outdoorCtrl.isAdmin = outdoorData.isAdmin;

        outdoorCtrl.mapConfiguration = {
            zoom    : 7,
            map_type: 'TERRAIN',
            center  : [41.87194, 12.56738]
        };

        let dynamicTags = [];

        NgMap.getMap('outdoor-map').then(function (map) {
            let hideStyles = [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers    : [
                        {visibility: "off"}
                    ]
                }, {
                    featureType: "water",
                    elementType: "labels",
                    stylers    : [
                        {visibility: "off"}
                    ]
                }, {
                    featureType: "road",
                    elementType: "labels",
                    stylers    : [
                        {visibility: "off"}
                    ]
                }
            ];

            map.set('styles', hideStyles);

            socketService.sendRequest('get_location_info', {})
                .then(function (response) {
                    let message  = JSON.parse(response.data);
                    locationInfo = message.result[0].name;

                    return socketService.sendRequest('get_tags_by_location', {location: locationInfo})
                })
                .then(function (response) {
                    tags = response.result;

                    for (let i = 0; i < tags.length; i++) {
                        let latLng = new google.maps.LatLng(tags[i].gps_north_degree, tags[i].gps_east_degree);
                        let marker = new google.maps.Marker({
                            position : latLng,
                            animation: google.maps.Animation.DROP,
                            icon     : '../SMARTSTUDIO/img/icons/tags/tag-online-48.png'
                        });

                        let infoContent = '<div class="marker-info-container">' +
                            '<img src="../SMARTSTUDIO/img/icons/login-icon.png" class="tag-info-icon">' +
                            '<p class="text-center font-large">' + tags[i].name.toUpperCase() + '</p>' +
                            '<div><p class="float-left">Latitude: </p><p class="float-right">' + tags[i].gps_north_degree + '</p></div>' +
                            '<div class="clear-float"><p class="float-left">Longitude: </p><p class="float-right">' + tags[i].gps_east_degree + '</p></div>' +
                            '</div>';

                        if (isOutdoor(tags[i]) && (new Date(Date.now()) - (new Date(tags[i].time)) < tags[i].sleep_time_outdoor)) {
                            setIcon(tags[i], marker);

                            marker.addListener('click', function () {
                                let infoWindow = new google.maps.InfoWindow({
                                    content: infoContent
                                });

                                infoWindow.open(map, marker);
                            });

                            dynamicTags.push(marker);
                            bounds.extend(marker.getPosition());
                        } else {
                            if (checkAlarms(tags[i])) {
                                setIcon(tags[i], marker);
                                let infoWindow = new google.maps.InfoWindow({
                                    content: infoContent
                                });
                                marker.addListener('mouseover', function () {

                                    infoWindow.open(map, marker);
                                });

                                marker.addListener('mouseout', function () {
                                    infoWindow.close(map, marker);
                                });

                                dynamicTags.push(marker);
                                bounds.extend(marker.getPosition());
                            }
                        }
                    }

                    outdoorCtrl.markerClusterer = new MarkerClusterer(map, dynamicTags, {imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});

                    if (dynamicTags.length > 0) {
                        map.setCenter(bounds.getCenter());
                        map.fitBounds(bounds);
                    } else {
                        let latLng = new google.maps.LatLng(dataService.location.latitude, dataService.location.longitude);
                        map.setCenter(latLng);
                        map.setZoom(10)
                    }

                    constantUpdateMapTags(map, bounds);
                })
        });


        let constantUpdateMapTags = function (map, bounds) {
            updateMapTimer = $interval(function () {
                socketService.sendRequest('get_tags_by_location', {location: locationInfo})
                    .then(function (response) {
                        let mess = JSON.parse(response.data);
                        tags     = mess.result;
                        for (let i = 0; i < tags.length; i++) {
                            let latLng = new google.maps.LatLng(tags[i].gps_north_degree, tags[i].gps_east_degree);

                            let marker = new google.maps.Marker({
                                position : latLng,
                                animation: google.maps.Animation.DROP,
                                icon     : '../SMARTSTUDIO/img/icons/tags/tag-online-48.png'
                            });

                            let infoContent = '<div class="marker-info-container">' +
                                '<img src="../SMARTSTUDIO/img/icons/login-icon.png" class="tag-info-icon">' +
                                '<p class="text-center font-large">' + tags[i].name.toUpperCase() + '</p>' +
                                '<div><p class="float-left">Latitude: </p><p class="float-right">' + tags[i].gps_north_degree + '</p></div>' +
                                '<div class="clear-float"><p class="float-left">Longitude: </p><p class="float-right">' + tags[i].gps_east_degree + '</p></div>';

                            if (isOutdoor(tags[i]) && (new Date(Date.now()) - (new Date(tags[i].time)) < tags[i].sleep_time_outdoor)) {
                                setIcon(tags[i], marker);

                                // marker.addListener('mouseover', function () {
                                //     let infoWindow = new google.maps.InfoWindow({
                                //         content: infoContent
                                //     });
                                //
                                //     infoWindow.open(map, marker);
                                // });

                                if (checkAlarms(tags[i])) {
                                    if (markerIsOnMap(dynamicTags, marker)) {
                                        for (let m = 0; m < dynamicTags.length; m++) {
                                            if (dynamicTags[m].getPosition().equals(marker.getPosition())) {
                                                if (marker.getIcon() !== dynamicTags[m].getIcon()) {
                                                    dynamicTags[m].setMap(null);
                                                    dynamicTags.splice(m, 1);
                                                    marker.setMap(map);
                                                    dynamicTags.push(marker);
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    if (markerIsOnMap(dynamicTags, marker)) {
                                        for (let m = 0; m < dynamicTags.length; m++) {
                                            if (dynamicTags[m].getPosition().equals(marker.getPosition())) {
                                                if (dynamicTags[m].getIcon() !== marker.getIcon()) {
                                                    dynamicTags[m].setMap(null);
                                                    dynamicTags.splice(m, 1);
                                                    marker.setMap(map);
                                                    dynamicTags.push(marker);
                                                }
                                            }
                                        }
                                    } else {
                                        dynamicTags.push(marker);
                                        marker.setMap(map);
                                    }
                                }
                            } else if (isOutdoor(tags[i])) {
                                if (checkAlarms(tags[i])) {
                                    setIcon(tags[i], marker);

                                    // marker.addListener('click', function () {
                                    //     let infoWindow = new google.maps.InfoWindow({
                                    //         content: infoContent
                                    //     });
                                    //
                                    //     infoWindow.open(map, marker);
                                    // });

                                    if (markerIsOnMap(dynamicTags, marker)) {
                                        for (let m = 0; m < dynamicTags.length; m++) {
                                            if (dynamicTags[m].getPosition().equals(marker.getPosition())) {
                                                if (marker.getIcon() !== dynamicTags[m].getIcon()) {
                                                    dynamicTags[m].setMap(null);
                                                    dynamicTags.splice(m, 1);
                                                }
                                            }
                                        }
                                    } else {
                                        dynamicTags.push(marker);
                                        marker.setMap(map);
                                        bounds.extend(marker.getPosition());
                                    }
                                } else {
                                    for (let m = 0; m < dynamicTags.length; m++) {
                                        if (dynamicTags[m].getPosition().equals(marker.getPosition())) {
                                            dynamicTags[m].setMap(null);
                                            dynamicTags.splice(m, 1);
                                        }
                                    }
                                }
                            }
                        }
                        //
                        // if (dynamicTags.length > 0) {
                        //     setMapOnAll(map, dynamicTags);
                        // }
                    })
            }, 2000)
        };

        let setIcon = function (tag, marker) {
            if (tag.sos) {
                marker.setIcon('../SMARTSTUDIO/img/icons/tags/sos.png');
            } else if (tag.battery_status) {
                marker.setIcon('../SMARTSTUDIO/img/icons/tags/battery-empty.png');
            } else if (tag.man_down) {
                marker.setIcon('../SMARTSTUDIO/img/icons/tags/man-down.png');
            } else if (tag.man_down_disabled) {
                marker.setIcon('../SMARTSTUDIO/img/icons/tags/man-down-disabled.png');
            } else if (tag.man_down_tacitated) {
                marker.setIcon('../SMARTSTUDIO/img/icons/tags/man-down-tacitated.png');
            } else if (tag.man_in_quote) {
                marker.setIcon('../SMARTSTUDIO/img/icons/tags/man-in-quote.png');
            } else if (tag.call_me_alarm) {
                marker.setIcon('../SMARTSTUDIO/img/icons/tags/call-me.png');
            } else if (tag.diagnostic_request) {
                marker.setIcon('../SMARTSTUDIO/img/icons/tags/diagnostic-request.png');
            }
        };

        let markerIsOnMap = function (markers, marker) {
            for (let m = 0; m < markers.length; m++) {
                if (markers[m].getPosition().equals(marker.getPosition()))
                    return true;
            }
            return false;
        };

        let isOutdoor = function (tag) {
            return tag.gps_north_degree !== 0 && tag.gps_east_degree !== 0;
        };

        let checkAlarms = function (tag) {
            return tag.sos || tag.battery_status || tag.man_down || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote || tag.call_me_alarm
                || tag.diagnostic_request;
        };

        function setMarkerOnMap(map, tags) {
            angular.forEach(tags, function (key) {
                key.addListener('click', function () {
                    let infoWindow = new google.maps.InfoWindow({
                        content: '<div class="marker-info-container">' +
                            '<img src="../SMARTSTUDIO/img/icons/login-icon.png" class="tag-info-icon">' +
                            '<p class="text-center font-large"></p>' +
                            '<p></p>' +
                            '</div>'
                    });

                    infoWindow.open(map, key);
                });
                key.setMap(map);
            })
        }

        $scope.showAlarms = function () {
            $mdDialog.show({
                locals             : {tags: tags},
                templateUrl        : '../SMARTSTUDIO/components/outdoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'tags', function ($scope, tags) {
                    $scope.alarms = {};

                    for (let i = 0; i < tags.length; i++) {
                        if (tags[i].sos) {
                            $scope.alarms['sos_' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'SOS',
                                description: 'Richiesta di aiuto immediato.',
                                image      : '../SMARTSTUDIO/img/icons/tags/sos.png'
                            };
                        }
                        if (tags[i].battery_status) {
                            $scope.alarms['battery_status_' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Batteria scarica',
                                description: 'La batteria e\' scarica.',
                                image      : '../SMARTSTUDIO/img/icons/tags/battery-empty.png'
                            };
                        }
                        if (tags[i].man_down) {
                            $scope.alarms['man_down_' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Uomo a terra',
                                description: 'Uomo a terra, mandare soccorso',
                                image      : '../SMARTSTUDIO/img/icons/tags/man-down.png'
                            };
                        }
                        if (tags[i].man_down_disabled) {
                            $scope.alarms['man_down_disabled_' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Uomo a terra disabilitato',
                                description: 'Uomo a terra disabilitato',
                                image      : '../SMARTSTUDIO/img/icons/tags/man-down-disabled.png'
                            };
                        }
                        if (tags[i].man_down_tacitated) {
                            $scope.alarms['man_down_tacitated_' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Man down tacitated',
                                description: 'Man down tacitated.',
                                image      : '../SMARTSTUDIO/img/icons/tags/man-down-tacitated.png'
                            };
                        }
                        if (tags[i].man_in_quote) {
                            $scope.alarms['man_in_quote' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Man in quote',
                                description: 'Man in quote.',
                                image      : '../SMARTSTUDIO/img/icons/tags/man-in-quote.png'
                            };
                        }
                        if (tags[i].call_me_alarm) {
                            $scope.alarms['call_me_alarm_' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Call_me_alarm',
                                description: 'Call me alarm.',
                                image      : '../SMARTSTUDIO/img/icons/tags/call-me-alarm.png'
                            };
                        }
                        if (tags[i].diagnostic_request) {
                            $scope.alarms['diagnostic_request' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Diagnostic request',
                                description: 'Diagnostic request.',
                                image      : '../SMARTSTUDIO/img/icons/tags/diagnostic-request.png'
                            };
                        }
                    }

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        $scope.showOfflineTags = function () {
            $mdDialog.show({
                locals             : {tags: tags},
                templateUrl        : '../SMARTSTUDIO/components/show-offline-tags.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'tags', function ($scope, tags) {

                    $scope.offlineTags = {};

                    for (let i = 0; i < tags.length; i++) {
                        if ((tags[i].gps_north_degree !== 0 && tags[i].gps_east_degree !== 0) && (new Date(Date.now()) - (new Date(tags[i].time)) > tags[i].sleep_time_outdoor)) {
                            $scope.offlineTags[tags[i].name] = {
                                name : tags[i].name,
                                image: '../SMARTSTUDIO/img/icons/tags/tag-offline.png'
                            }
                        }
                    }

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };
        $scope.$on('$destroy', function () {
            $interval.cancel(updateMapTimer);
            bounds = new google.maps.LatLngBounds(null);
        })
    }

    /**
     * Function that handles the canvas interaction
     * @type {string[]}
     */
    canvasController.$inject = ['$scope', '$location', '$mdDialog', '$timeout', '$interval', 'socketService', 'canvasData', 'dataService'];

    function canvasController($scope, $location, $mdDialog, $timeout, $interval, socketService, canvasData, dataService) {
        let canvasCtrl    = this;
        let canvas        = document.querySelector('#canvas-id');
        let context       = canvas.getContext('2d');
        let bufferCanvas  = document.createElement('canvas');
        let bufferContext = bufferCanvas.getContext('2d');
        let canvasImage   = new Image();

        canvasCtrl.canvasInterval         = undefined;
        canvasCtrl.floors                 = dataService.floors;
        canvasCtrl.showAlarmsIcon         = false;
        canvasCtrl.showOfflineTagsIcon    = false;
        canvasCtrl.showOfflineAnchorsIcon = false;

        (dataService.defaultFloorName === '')
            ? canvasCtrl.defaultFloor = [dataService.floors[0]]
            : canvasCtrl.defaultFloor = dataService.userFloors.filter(f => f.name === dataService.defaultFloorName);

        //floor initial data
        canvasCtrl.floorData = {
            defaultFloorName: canvasCtrl.defaultFloor[0].name,
            gridSpacing     : canvasCtrl.defaultFloor[0].map_spacing,
            location        : (dataService.locationFromClick === '') ? dataService.location : dataService.locationFromClick,
            floor_image_map : canvasCtrl.defaultFloor[0].image_map
        };

        //canvas show/hide switch variable
        canvasCtrl.switch = {
            showGrid      : false,
            showAnchors   : true,
            showCameras   : true,
            showRadius    : true,
            showDrawing   : false,
            showFullscreen: false,
        };

        //watching for changes in switch buttons in menu
        $scope.$watchGroup(['canvasCtrl.switch.showGrid', 'canvasCtrl.switch.showAnchors', 'canvasCtrl.switch.showCameras', 'canvasCtrl.floorData.gridSpacing', 'canvasCtrl.switch.showDrawing'], function (newValues) {
            if (canvasCtrl.defaultFloor[0].map_spacing !== newValues[3])
                canvasCtrl.defaultFloor[0].map_spacing = newValues[3];

            //TODO - control if drawing is off, - control if interval is undefined and start it if so, - resetting the switch buttons
            //     - if drawing is on stop the interval and set it to undefined, - reset the switch buttons, - reload canvas

            //THE FACT THAT I AM CALLING HERE UPDATE FLOOR IS CREATING THE GLITCH
            // canvasCtrl.loadFloor(false, false, false)
        });

        //watching the fullscreen switch button
        $scope.$watch('canvasCtrl.switch.fullscreen', function (newValue) {
            if (newValue) {
                openFullScreen(document.querySelector('#canvas-container'));
                canvasCtrl.switch.fullscreen = false;
            }
        });

        //watching the floor selection button
        $scope.$watch('canvasCtrl.floorData.defaultFloorName', function (newValue) {
            canvasCtrl.defaultFloor = [dataService.userFloors.filter(f => {
                return f.name === newValue
            })[0]];

            canvasCtrl.floorData.defaultFloorName = canvasCtrl.defaultFloor[0].name;
            canvasCtrl.floorData.gridSpacing      = canvasCtrl.defaultFloor[0].map_spacing;
            canvasCtrl.floorData.floor_image_map  = canvasCtrl.defaultFloor[0].image_map;

        });

        //function that loads the floor map and starts the contrant update of the floor
        canvasCtrl.loadFloor = function () {
            let img = new Image();
            img.src = imagePath + 'floors/' + canvasCtrl.floorData.floor_image_map;

            img.onload = function () {
                canvas.width  = this.naturalWidth;
                canvas.height = this.naturalHeight;

                //updating the canvas and drawing border
                updateCanvas(canvas.width, canvas.height, context, img);
            };

            //constantly updating the canvas
            constantUpdateCanvas();
        };

        //controlling the alarms and setting the alarm icon
        let assigningTagImage = function (tag, image) {
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
                image.src = tagsIconPath + 'man-down-disabled.png';
            } else if (tag.man_down_tacitated) {
                image.src = tagsIconPath + 'man-down-tacitated.png';
            } else if (tag.man_in_quote) {
                image.src = tagsIconPath + 'man_in_quote_24.png';
            } else if (tag.call_me_alarm) {
                image.src = tagsIconPath + 'call_me_alarm_24.png';
            } else {
                image.src = tagsIconPath + 'online_tag_24.png';
            }
        };

        //loading all the images to be shown on the canvas asynchronously
        let loadImagesAsynchronouslyWithPromise = function (data, image) {
            //if no data is passed resolving the promise with a null value

            if (data.length === 0) {
                return Promise.resolve(null);
            } else {
                //loading all the images asynchronously
                return Promise.all(
                    data.map(function (value) {
                        return new Promise(function (resolve) {
                            let img = new Image();

                            if ((image === 'anchor' || image === 'camera') && value.is_online)
                                img.src = tagsIconPath + image + '_online_16.png';
                            else if (image === 'anchor' || image === 'camera' && !value.is_online)
                                img.src = tagsIconPath + image + '_offline_16.png';
                            else if (image === 'tag') {
                                //controling if is a cloud or a isolatedTags tag
                                if (value.length > 1) {
                                    let tagState = checkTagsStateAlarmNoAlarmOffline(value);

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
                                    if (checkIfTagHasAlarm(value[0])) {
                                        assigningTagImage(value[0], img);
                                    } else if (value[0].is_exit && !value[0].radio_switched_off) {
                                        img.src = tagsIconPath + 'offline_tag_24.png';
                                    } else if (!(value[0].is_exit && value[0].radio_switched_off)) {
                                        assigningTagImage(value[0], img);
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

        let loadAlarmsImagesWithPromise = function (images) {
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

        let getTagAlarms = function (tag) {
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

        //check if there is at least a tag with an alarm
        let checkTagsStateAlarmNoAlarmOffline = function (tags) {
            let tagState = {
                withAlarm   : false,
                withoutAlarm: false,
                offline     : false
            };

            tags.forEach(function (tag) {
                if (tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                    || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                    || tag.call_me_alarm || tag.diagnostic_request) {
                    tagState.withAlarm = true;
                } else if (tag.is_exit && !tag.radio_switched_off) {
                    tagState.offline = true;
                } else {
                    tagState.withoutAlarm = true;
                }
            });

            return tagState;
        };

        // let checkIfTagsHaveOffline = function (tags) {
        //         return tags.some(function (tag) {
        //             return tag.is_exit && !tag.radio_switched_off;
        //         });
        //     }
        // ;

        //checking if the tag has an alarm
        let checkIfTagHasAlarm     = function (tag) {
            return tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                || tag.call_me_alarm || tag.diagnostic_request;
        };

        //constantly updating the canvas with the objects position from the server
        let constantUpdateCanvas = function () {
            let alarmsCounts          = [0, 0, 0, 0, 0, 0, 0, 0, 0];
            canvasCtrl.canvasInterval = $interval(function () {
                canvasImage.src = imagePath + 'floors/' + canvasCtrl.floorData.floor_image_map;

                canvasImage.onload = function () {
                    bufferCanvas.width  = this.naturalWidth;
                    bufferCanvas.height = this.naturalHeight;

                    //updating the canvas and drawing border
                    updateCanvas(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasImage);

                    if (canvasCtrl.switch.showGrid) {
                        //drawing vertical
                        drawDashedLine(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, 'vertical');
                        //drawing horizontal lines
                        drawDashedLine(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, 'horizontal');
                    }

                    socketService.sendConstantRequest('get_anchors_by_floor_and_location', {
                        floor   : canvasCtrl.floorData.defaultFloorName,
                        location: canvasCtrl.floorData.location
                    })
                    //managing the anchors visualization
                        .then(function (response) {
                            dataService.anchors = response.result;
                            if (response.result.length > 0) {
                                loadAndDrawImagesOnCanvas(response.result, 'anchor', canvasCtrl.switch.showAnchors);
                                canvasCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(response.result);
                            }

                            return socketService.sendConstantRequest('get_cameras_by_floor_and_location', {
                                floor   : canvasCtrl.floorData.defaultFloorName,
                                location: canvasCtrl.floorData.location
                            })
                        })
                        //managing the cameras visualizzation
                        .then(function (response) {
                            // dataService.cameras = response.result;
                            if (response.result.length > 0)
                                loadAndDrawImagesOnCanvas(response.result, 'camera', canvasCtrl.switch.showCameras);

                            return socketService.sendConstantRequest('get_tags_by_floor_and_location', {
                                floor   : canvasCtrl.defaultFloor[0].id,
                                location: canvasCtrl.floorData.location
                            });
                        })
                        //managing the tags visualizzation
                        .then(function (response) {
                            dataService.playAlarmsAudio(response.result);
                            dataService.floorTags = response.result;

                            let tagClouds            = [];
                            let isolatedTags         = [];
                            let singleAndGroupedTags = [];
                            let step                 = 0;

                            let temporaryTagsArray   = {
                                singleTags: angular.copy(response.result),
                            };

                            for (let i = 0; i < response.result.length; i = step) {
                                //getting the near tags of the tag passed as second parameter
                                temporaryTagsArray = groupNearTags(temporaryTagsArray.singleTags, response.result[i]);

                                if (temporaryTagsArray.groupTags.length > 0) {
                                    singleAndGroupedTags.push(temporaryTagsArray.groupTags);
                                    step += temporaryTagsArray.groupTags.length;
                                } else {
                                    step++;
                                }
                            }

                            //getting the tag clouds
                            tagClouds    = singleAndGroupedTags.filter(x => x.length > 1);
                            //getting the remaining isolated tags
                            isolatedTags = singleAndGroupedTags.filter(x => x.length === 1);

                            loadImagesAsynchronouslyWithPromise(tagClouds, 'tag').then(
                                function (images) {
                                    //control if there are clouds to bhe shown
                                    if (images !== null) {
                                        //drawing the clouds on the canvas
                                        images.forEach(function (image, index) {
                                            drawCloudIcon(tagClouds[index][0], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[0].length);
                                        });
                                    }

                                    return loadImagesAsynchronouslyWithPromise(isolatedTags, 'tag');
                                })
                                .then(function (images) {
                                    if (images !== null) {
                                        //drawing the isolated tags
                                        isolatedTags.forEach(function (tag, index) {
                                            if (tag[0].gps_north_degree === 0 && tag[0].gps_east_degree === 0) {
                                                if (tag[0].tag_type_id === 1 || tag[0].tag_type_id === 5 || tag[0].tags_type_id === 13) {
                                                    // console.log('tag has id 1');
                                                    if (checkIfTagHasAlarm(tag[0])) {
                                                        loadAlarmsImagesWithPromise(getTagAlarms(tag[0]))
                                                            .then(function (alarmImages) {
                                                                if (alarmsCounts[index] > alarmImages.length - 1)
                                                                    alarmsCounts[index] = 0;
                                                                drawIcon(tag[0], bufferContext, alarmImages[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                                context.drawImage(bufferCanvas, 0, 0);
                                                            });
                                                    } else if (!(tag[0].is_exit && tag[0].radio_switched_off)) {
                                                        drawIcon(tag[0], bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                    }
                                                } else {
                                                    if (checkIfTagHasAlarm(tag[0])) {
                                                        loadAlarmsImagesWithPromise(getTagAlarms(tag[0]))
                                                            .then(function (alarmImages) {
                                                                if (alarmsCounts[index] > alarmImages.length - 1)
                                                                    alarmsCounts[index] = 0;

                                                                drawIcon(tag[0], bufferContext, alarmImages[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                                context.drawImage(bufferCanvas, 0, 0);
                                                            })
                                                    } else if ((new Date(Date.now()) - (new Date(tag[0].time)) < tag[0].sleep_time_indoor)) {
                                                        drawIcon(tag[0], bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                    }
                                                }
                                            }
                                        })
                                    }
                                    // context.clearRect(0, 0, canvas.width, canvas.height);
                                    context.drawImage(bufferCanvas, 0, 0);
                                });

                            //showing the offline anchors and alarm button
                            canvasCtrl.showOfflineTagsIcon = isTagOffline(response.result);

                            return socketService.sendConstantRequest('get_tags_by_user', {user: dataService.username})
                        })
                        .then(function (response) {
                            canvasCtrl.showAlarmsIcon = checkTagsStateAlarmNoAlarmOffline(response.result).withAlarm;
                        })
                }
            }, 1000);
        };

        canvasCtrl.loadFloor();

        //loading images and drawing them on canvas
        let loadAndDrawImagesOnCanvas = function (objects, objectType, hasToBeDrawn) {
            if (hasToBeDrawn) {
                loadImagesAsynchronouslyWithPromise(objects, objectType).then(
                    function (allImages) {
                        allImages.forEach(function (image, index) {
                            drawIcon(objects[index], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, false);
                        })
                    }
                )
            }
        };

        //grouping the tags in one object divided by clouds of tags and single tags
        let groupNearTags = function (tags, tag) {
            let tagsGrouping = {
                groupTags : [],
                singleTags: []
            };

            tags.forEach(function (tagElement) {
                if ((tagElement.x_pos - 0.5 < tag.x_pos && tag.x_pos < tagElement.x_pos + 0.5
                    && (tagElement.y_pos - 0.5 < tag.y_pos && tag.y_pos < tagElement.y_pos + 0.5)) && !(tagElement.is_exit && tagElement.radio_switched_off)) {
                    if (tagElement.tag_type_id !== 1) {
                        if (checkIfTagHasAlarm(tagElement) || ((new Date(Date.now()) - (new Date(tagElement.time))) < tagElement.sleep_time_indoor)) {
                            tagsGrouping.groupTags.push(tagElement)
                        }
                    } else {
                        tagsGrouping.groupTags.push(tagElement)
                    }
                } else {
                    tagsGrouping.singleTags.push(tagElement);
                }
            });

            return tagsGrouping;
        };

        // let isTagOffline = function (tags) {
        //     return tags.some(function (tag) {
        //         return tag.is_exit && !tag.radio_switched_off;
        //     })
        // };

        //getting the coordinate of the click within respect the canvas
        HTMLCanvasElement.prototype.canvasMouseClickCoords = function (event) {
            let totalOffsetX   = 0;
            let totalOffsetY   = 0;
            let canvasX, canvasY;
            let currentElement = this;

            do {
                totalOffsetX += currentElement.offsetLeft;
                totalOffsetY += currentElement.offsetTop;
            } while (currentElement = currentElement.offsetParent)

            canvasX = event.pageX - totalOffsetX;
            canvasY = event.pageY - totalOffsetY;

            // Fix for variable canvas width
            canvasX = Math.round(canvasX * (this.width / this.offsetWidth));
            canvasY = Math.round(canvasY * (this.height / this.offsetHeight));

            return {x: canvasX, y: canvasY}
        };

        //adding the mousedown listener to the canvas
        canvas.addEventListener('mousedown', function (event) {
            let coords      = canvas.canvasMouseClickCoords(event);
            let tagCloud    = null;
            let dialogShown = false;
            let realHeight  = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;

            //listen for the tags click
            dataService.floorTags.forEach(function (tag) {
                let virtualTagPosition = scaleIconSize(tag.x_pos, tag.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                tagCloud               = groupNearTags(dataService.floorTags, tag);

                if (tag.gps_north_degree === 0 || tag.gps_east_degree === 0) {
                    if (((virtualTagPosition.width - 20) < coords.x && coords.x < (virtualTagPosition.width + 20)) && ((virtualTagPosition.height - 20) < coords.y && coords.y < (virtualTagPosition.height + 20))) {
                        if (tagCloud.groupTags.length > 1) {
                            if (!dialogShown) {
                                $mdDialog.show({
                                    locals             : {tags: tagCloud.groupTags},
                                    templateUrl        : '../SMARTSTUDIO/components/tags-info.html',
                                    parent             : angular.element(document.body),
                                    targetEvent        : event,
                                    clickOutsideToClose: true,
                                    controller         : ['$scope', 'tags', function ($scope, tags) {
                                        $scope.tags         = tags;
                                        $scope.isTagInAlarm = 'background-red';
                                        let tempAlarmTag    = [];

                                        tagCloud.groupTags.forEach(function (tagElem) {
                                            let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tagElem);
                                            tagAlarms.forEach(function (ta) {
                                                tempAlarmTag.push(ta);
                                            })
                                        });

                                        $scope.alarms = tempAlarmTag;

                                        $scope.hide = function () {
                                            $mdDialog.hide();
                                        }
                                    }]
                                })
                            }
                            dialogShown = true;
                        } else {
                            if (tag.tag_type_id === 1 || tag.tag_type_id === 5) {
                                if (!(tag.is_exit && tag.radio_switched_off)) {
                                    $mdDialog.show({
                                        locals             : {tag: tag},
                                        templateUrl        : '../SMARTSTUDIO/components/tag-info.html',
                                        parent             : angular.element(document.body),
                                        targetEvent        : event,
                                        clickOutsideToClose: true,
                                        controller         : ['$scope', 'tag', function ($scope, tag) {
                                            $scope.tag          = tag;
                                            $scope.isTagInAlarm = 'background-red';
                                            $scope.alarms       = dataService.loadTagAlarmsForInfoWindow(tag);

                                            if ($scope.alarms.length === 0) {
                                                ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                                                    ? $scope.isTagInAlarm = 'background-gray'
                                                    : $scope.isTagInAlarm = 'background-green';
                                            }

                                            $scope.hide = function () {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    })
                                }
                            } else if (checkIfTagHasAlarm(tag) || (new Date(Date.now()) - (new Date(tag.time)) < tag.sleep_time_indoor)) {
                                $mdDialog.show({
                                    locals             : {tag: tag},
                                    templateUrl        : '../SMARTSTUDIO/components/tag-info.html',
                                    parent             : angular.element(document.body),
                                    targetEvent        : event,
                                    clickOutsideToClose: true,
                                    controller         : ['$scope', 'tag', function ($scope, tag) {
                                        $scope.tag          = tag;
                                        $scope.isTagInAlarm = 'background-red';
                                        $scope.alarms       = dataService.loadTagAlarmsForInfoWindow(tag);

                                        if ($scope.alarms.length === 0) {
                                            $scope.isTagInAlarm = 'background-green';
                                        }

                                        $scope.hide = function () {
                                            $mdDialog.hide();
                                        }
                                    }]
                                })
                            }
                        }
                    }
                }
            });

            //listen for anchors click events
            dataService.anchors.forEach(function (anchor) {
                if (!isTagAtCoords(coords)) {
                    let virtualAnchorPosition = scaleIconSize(anchor.x_pos, anchor.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height)
                    if (((virtualAnchorPosition.width - 20) < coords.x && coords.x < (virtualAnchorPosition.width + 20)) && ((virtualAnchorPosition.height - 20) < coords.y && coords.y < (virtualAnchorPosition.height + 20))) {
                        $mdDialog.show({
                            locals             : {anchor: anchor},
                            templateUrl        : '../SMARTSTUDIO/components/anchor-info.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            controller         : ['$scope', 'anchor', function ($scope, anchor) {
                                $scope.anchor         = anchor;
                                $scope.isAnchorOnline = 'background-green';

                                if (!anchor.is_online) {
                                    $scope.isAnchorOnline = 'background-gray';
                                }

                                $scope.hide = function () {
                                    $mdDialog.hide();
                                }
                            }]
                        })
                    }
                }
            });

            //listen for the cameras click events
            dataService.cameras.forEach(function (camera) {
                if (!isTagAtCoords(coords)) {
                    let virtualCamerasPosition = scaleIconSize(tag.x_pos, tag.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                    if (((virtualCamerasPosition.width - 20) < coords.x && coords.x < (virtualCamerasPosition.width + 20)) && ((virtualCamerasPosition.height - 20) < coords.y && coords.y < (virtualCamerasPosition.height + 20))) {
                        console.log(camera.description);
                    }
                }
            });
        }, false);

        //showing the info window with all the alarms
        $scope.showAlarms = function () {
            $mdDialog.show({
                templateUrl        : '../SMARTSTUDIO/components/indoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'socketService', 'dataService', function ($scope, socketService, dataService) {
                    let tags      = null;
                    $scope.alarms = [];


                    socketService.sendRequest('get_tags_by_user', {user: dataService.username})
                        .then(function (response) {
                            tags = response.result;
                            response.result.forEach(function (tag) {
                                let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tag);
                                tagAlarms.forEach(function (tagAlarm) {
                                    $scope.alarms.push(tagAlarm);
                                })
                            });
                        });

                    $scope.loadLocation = function (alarm) {
                        let tag = tags.filter(t => t.name === alarm.tag);

                        canvasCtrl.floorData.defaultFloorName = tag[0].floor_name;
                        canvasCtrl.floorData.location         = tag[0].location_name;

                        $mdDialog.hide();
                    };

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        let isTagAtCoords = function (coords) {
            return dataService.floorTags.some(function (tag) {
                let realHeight         = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;
                let virtualTagPosition = scaleIconSize(tag.x_pos, tag.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height)
                return (tag.gps_north_degree === 0 || tag.gps_east_degree === 0) && (((virtualTagPosition.width - 20) < coords.x && coords.x < (virtualTagPosition.width + 20)) && ((virtualTagPosition.height - 20) < coords.y && coords.y < (virtualTagPosition.height + 20)));
            })
        };

        //showing the info window with the online/offline tags
        $scope.showOfflineTagsIndoor = function () {
            dataService.showOfflineTags();
        };

        //showing the info window with the online/offline anchors
        $scope.showOfflineAnchorsIndoor = function () {
            dataService.showOfflineAnchors();
        };

        $scope.showEmergencyZone = function () {
            $mdDialog.show({
                locals             : {floor: canvasCtrl.defaultFloor[0].name, tags: dataService.floorTags},
                templateUrl        : '../SMARTSTUDIO/components/emergency-alarm-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'floor', 'tags', function ($scope, floor, tags) {
                    $scope.safeTags   = null;
                    $scope.unsafeTags = [];
                    $scope.data       = [];

                    $scope.men = {
                        safe  : 0,
                        unsafe: 0
                    };

                    $scope.colors = ["#4BAE5A", "#E13044"];
                    $scope.labels = ["Persone in zona di evacuazione", "Persone disperse"];

                    socketService.sendRequest('get_emergency_info', {location: dataService.location, floor: floor})
                        .then(function (response) {
                            $scope.safeTags   = response.result;
                            $scope.unsafeTags = tags.filter(t => !response.result.some(i => i.tag_name === t.name));

                            $scope.men.safe   = response.result.length;
                            $scope.men.unsafe = tags.length - response.result.length;

                            $scope.data = [$scope.men.safe, $scope.men.unsafe];
                        });

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        $scope.$on("$destroy", function () {
            $interval.cancel(canvasCtrl.canvasInterval);
        });
    }

    /**
     * Function that handle the menu interaction
     * @type {string[]}
     */
    menuController.$inject = ['$scope', '$mdDialog', '$mdEditDialog', '$location', '$state', '$filter', '$timeout', '$mdSidenav', 'NgMap', 'dataService', 'socketService'];

    function menuController($scope, $mdDialog, $mdEditDialog, $location, $state, $filter, $timeout, $mdSidenav, NgMap, dataService, socketService) {

        let searchMarker   = new google.maps.Marker({});
        $scope.isAdmin     = dataService.isAdmin;
        $scope.tags        = dataService.tags;
        $scope.selectedTag = '';
        $scope.switch      = {
            mapFullscreen: false
        };

        $scope.toggleLeft = function () {
            $mdSidenav('left').toggle();
        };

        $scope.insertLocation = function () {
            $mdDialog.show({
                templateUrl        : '../SMARTSTUDIO/components/insert-location.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', function ($scope) {
                    let fileInput = null;

                    $scope.location = {
                        name       : '',
                        description: '',
                        latitude   : '',
                        longitude  : '',
                        showSuccess: false,
                        showError  : false,
                        message    : '',
                        resultClass: ''
                    };

                    $scope.insertLocation = function (form) {
                        form.$submitted = true;

                        if (form.$valid) {
                            let file     = null;
                            let fileName = null;

                            if (fileInput != null && fileInput.files.length !== 0) {
                                file     = fileInput.files[0];
                                fileName = file.name;
                            }

                            socketService.sendRequest('get_user', {})
                                .then(
                                    function (response) {
                                        let user = JSON.parse(response.data);

                                        return socketService.sendRequest('insert_location', {
                                            user       : user.result.id,
                                            name       : $scope.location.name,
                                            description: $scope.location.description,
                                            latitude   : $scope.location.latitude,
                                            longitude  : $scope.location.longitude,
                                            imageName  : fileName,
                                        })
                                    })
                                .then(
                                    function (result) {
                                        let res = JSON.parse(result.data);
                                        if (res.result !== undefined && res.result !== 0) {
                                            if (file != null) {
                                                return convertImageToBase64(file);
                                            }
                                        } else {
                                            $scope.location.showSuccess = false;
                                            $scope.location.showError   = true;
                                            $scope.location.message     = 'Impossibile inserire la posizione.';
                                            $scope.location.resultClass = 'background-red';
                                        }
                                    })
                                .then(
                                    function (result) {
                                        return socketService.sendRequest('save_marker_image', {
                                            imageName: fileName,
                                            image    : result
                                        })
                                    })
                                .then(function (response) {
                                        if (response.result === false) {
                                            $scope.location.showSuccess = false;
                                            $scope.location.showError   = true;
                                            $scope.location.message     = "Posizione inserita senza salvare l'immagine";
                                            $scope.resultClass          = 'background-orange'
                                        } else {
                                            $scope.location.resultClass = 'background-green';
                                            $scope.location.showSuccess = true;
                                            $scope.location.showError   = false;
                                            $scope.location.message     = 'Posizione inserita con successo';

                                            $scope.$apply();

                                            $timeout(function () {
                                                // $mdDialog.hide();
                                                window.location.reload();
                                            }, 1000);
                                        }
                                    }
                                ).catch(function (error) {
                                $scope.location.showSuccess = false;
                                $scope.location.showError   = true;
                                $scope.location.message     = 'Impossibile inserire la posizione';
                                $scope.location.resultClass = 'background-red';
                            })
                        } else {
                            $scope.location.resultClass = 'background-red';
                        }
                    };

                    $scope.uploadMarkerImage = function () {
                        fileInput = document.getElementById('marker-image');
                        fileInput.click();
                    };

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        $scope.viewHistory = function () {
            $mdDialog.show({
                templateUrl        : '../SMARTSTUDIO/components/history.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', function ($scope) {
                    let from = new Date();
                    from.setDate(from.getDate() - 7);

                    $scope.tableEmpty = false;

                    $scope.history = {
                        fromDate     : from,
                        toDate       : new Date(),
                        tags         : null,
                        events       : null,
                        selectedTag  : null,
                        selectedEvent: null
                    };

                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order       : 'Data',
                        limit       : 5,
                        page        : 1
                    };

                    $scope.historyRows = [];

                    $scope.$watchGroup(['history.fromDate', 'history.toDate', 'history.selectedTag', 'history.selectedEvent'], function (newValues) {
                        let fromDate = $filter('date')(newValues[0], 'yyyy-MM-dd');
                        let toDate   = $filter('date')(newValues[1], 'yyyy-MM-dd');

                        socketService.sendRequest('get_events', {})
                            .then(function (response) {
                                $scope.history.events = response.result;
                                $scope.history.tags   = dataService.tags;
                                $scope.$apply();
                                return socketService.sendRequest('get_history', {
                                    fromDate: fromDate,
                                    toDate  : toDate,
                                    tag     : newValues[2],
                                    event   : newValues[3]
                                })
                            })
                            .then(function (response) {
                                $scope.historyRows = response.result;
                                $scope.$apply();

                                $scope.tableEmpty = $scope.historyRows.length === 0;
                                $scope.$apply();
                            });
                    });

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]

            });
        };

        $scope.changePassword = function () {
            $mdDialog.show({
                templateUrl        : '../SMARTSTUDIO/components/change-password.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', function ($scope) {
                    $scope.changePassword = {
                        oldPassword  : '',
                        newPassword  : '',
                        reNewPassword: '',
                        resultClass  : '',
                        showSuccess  : false,
                        showError    : false,
                        message      : false
                    };

                    $scope.sendPassword = function (form) {
                        form.$submitted = true;

                        if ($scope.changePassword.newPassword !== $scope.changePassword.reNewPassword) {
                            $scope.changePassword.resultClass = 'background-red';
                            $scope.changePassword.showError   = true;
                            $scope.changePassword.showSuccess = false;
                            $scope.changePassword.message     = "Le password devono coincidere!";
                        } else {
                            if (form.$valid) {

                                socketService.sendRequest('change_password', {
                                    oldPassword: $scope.changePassword.oldPassword,
                                    newPassword: $scope.changePassword.newPassword
                                })
                                    .then(function (response) {
                                        if (response.result === 'wrong_old') {
                                            $scope.changePassword.resultClass = 'background-red';
                                            $scope.changePassword.showError   = true;
                                            $scope.changePassword.showSuccess = false;
                                            $scope.changePassword.message     = 'Vecchia password non valida';
                                        } else if (response.result === 'error_on_changing_password') {
                                            $scope.changePassword.resultClass = 'background-red';
                                            $scope.changePassword.showSuccess = false;
                                            $scope.changePassword.showError   = true;
                                            $scope.changePassword.message     = "Impossibile cambiare la password!";
                                            $timeout(function () {
                                                $mdDialog.hide();
                                            }, 1000);
                                        } else {
                                            $scope.changePassword.resultClass = 'background-green';
                                            $scope.changePassword.showSuccess = true;
                                            $scope.changePassword.showError   = false;
                                            $scope.changePassword.message     = "Password cambiata correnttamente!";
                                            $timeout(function () {
                                                $mdDialog.hide();
                                            }, 1000);
                                        }
                                        $scope.$apply();
                                    });
                            } else {
                                $scope.changePassword.resultClass = 'background-red';
                            }
                        }
                    };

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            });
        };

        $scope.registry = function () {
            $mdDialog.show({
                locals             : {admin: $scope.isAdmin},
                templateUrl        : '../SMARTSTUDIO/components/change-registry.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected     = [];
                    $scope.tags         = [];
                    $scope.query        = {
                        limitOptions: [5, 10, 15],
                        order: 'name',
                        limit: 5,
                        page : 1
                    };

                    socketService.sendRequest('get_tags_by_user', {user: dataService.username})
                        .then(function (response) {
                            $scope.tags = response.result;
                        });

                    $scope.editCell = function (event, tag, tagName) {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue : tag[tagName],
                                save       : function (input) {
                                    input.$invalid = true;
                                    tag[tagName]   = input.$modelValue;
                                    socketService.sendRequest('change_tag_field', {
                                        tag_id     : tag.id,
                                        tag_field  : tagName,
                                        field_value: input.$modelValue
                                    })
                                        .then(function (response) {
                                            if (response.result !== 1)
                                                console.log(response.result);
                                        })
                                },
                                targetEvent: event,
                                title      : 'Inserisci un valore',
                                validators : {
                                    'md-maxlength': 30
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        $scope.showAnchorsTable = function () {
            $mdDialog.show({
                locals             : {admin: $scope.isAdmin},
                templateUrl        : '../SMARTSTUDIO/components/anchors.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected     = [];

                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order: 'name',
                        limit: 5,
                        page : 1
                    };

                    socketService.sendRequest('get_anchors_by_user', {user: dataService.username})
                        .then(function (response) {
                            $scope.anchors = response.result;
                        });

                    $scope.editCell = function (event, anchor, anchorName) {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue : anchor[anchorName],
                                save       : function (input) {
                                    input.$invalid     = true;
                                    anchor[anchorName] = input.$modelValue;
                                    socketService.sendRequest('change_anchor_field', {
                                        anchor_id   : anchor.id,
                                        anchor_field: anchorName,
                                        field_value : input.$modelValue
                                    })
                                        .then(function (response) {
                                            if (response.result !== 1)
                                                console.log(response.result);
                                        })
                                },
                                targetEvent: event,
                                title      : 'Inserisci un valore',
                                validators : {
                                    'md-maxlength': 30
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    $scope.hideAnchors = function () {
                        $mdDialog.hide();
                    };
                }]
            });
        };

        $scope.floorUpdate = function () {
            $mdDialog.show({
                locals             : {admin: $scope.isAdmin},
                templateUrl        : '../SMARTSTUDIO/components/floor-settings.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected     = [];

                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order: 'name',
                        limit: 5,
                        page : 1
                    };

                    $scope.floors = dataService.floors;

                    $scope.editCell = function (event, floor, floorName) {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue : floor[floorName],
                                save       : function (input) {
                                    input.$invalid   = true;
                                    floor[floorName] = input.$modelValue;
                                    socketService.sendRequest('change_floor_field', {
                                        floor_id   : floor.id,
                                        floor_field: floorName,
                                        field_value: input.$modelValue
                                    })
                                        .then(function (response) {
                                            if (response.result !== 1)
                                                console.log(response.result);
                                        })
                                },
                                targetEvent: event,
                                title      : 'Inserisci un valore',
                                validators : {
                                    'md-maxlength': 30
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    $scope.uploadFloorImage = function (id) {

                        let fileInput = document.getElementById('floor-image-' + id);

                        $scope.floorId = id;
                        fileInput.click();
                    };

                    $scope.fileNameChanged = function () {
                        let fileInput = document.getElementById('floor-image-' + $scope.floorId);
                        let file      = null;
                        let fileName  = null;

                        if (fileInput != null && fileInput.files.length !== 0) {
                            file     = fileInput.files[0];
                            fileName = file.name;
                        }

                        if (file != null) {
                            convertImageToBase64(file)
                                .then(function (result) {
                                    return socketService.sendRequest('save_floor_image', {
                                        id   : $scope.floorId,
                                        image: result,
                                        name : fileName
                                    })
                                })
                                .then(function (response) {
                                    console.log(response);
                                })
                        }
                    };

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        //function that makes the logout of the user
        $scope.logout = function () {
            socketService.sendRequest('logout', {}).then(
                function (response) {
                    if (response.result === 'logged_out')
                        $state.go('login');
                }
            )
        };

        $scope.$watch('selectedTag', function (newValue, oldValue) {
            console.log(newValue);
            if (newValue !== '') {
                let newTag = $filter('filter')(dataService.tags, newValue)[0];
                let oldTag = $filter('filter')(dataService.tags, oldValue)[0];
                if (newTag.gps_north_degree === 0 && newTag.gps_east_degree === 0) {
                    //TODO mostrare tag su canvas
                    $mdDialog.show({
                        locals             : {tags: dataService.tags, outerScope: $scope},
                        templateUrl        : '../SMARTSTUDIO/components/search-tag-inside.html',
                        parent             : angular.element(document.body),
                        targetEvent        : event,
                        clickOutsideToClose: true,
                        controller         : ['$scope', 'tags', 'outerScope', 'socketService', function ($scope, tags, outerScope, socketService) {
                            let canvas  = null;
                            let context = null;
                            let tag     = tags.find(x => x.name === newValue);

                            $scope.floorData = {
                                location : '',
                                floorName: ''
                            };

                            $timeout(function () {
                                canvas  = document.querySelector('#search-canvas-id');
                                context = canvas.getContext('2d');
                            }, 0);

                            socketService.sendRequest('get_tag_floor', {tag: tag.id})
                                .then(function (response) {
                                    $scope.floorData.location  = response.result[0].location_name;
                                    $scope.floorData.floorName = response.result[0].name;

                                    let img = new Image();
                                    img.src = imagePath + 'floors/' + response.result[0].image_map;

                                    img.onload = function () {
                                        canvas.width  = this.naturalWidth;
                                        canvas.height = this.naturalHeight;

                                        //updating the canvas and drawing border
                                        updateCanvas(canvas.width, canvas.height, context, img);

                                        let tagImg = new Image();
                                        tagImg.src = imagePath + 'icons/tags/online_tag_24.png';

                                        tagImg.onload = function () {
                                            drawIcon(tag, context, tagImg, response.result[0].width, canvas.width, canvas.height, true);
                                        }
                                    };
                                });

                            $scope.hide = function () {
                                outerScope.selectedTag = '';
                                $mdDialog.hide();
                            }
                        }]
                    })

                } else {
                    $state.go('home');
                    let latLng = new google.maps.LatLng(newTag.gps_north_degree, newTag.gps_east_degree);
                    NgMap.getMap('main-map').then(
                        function (map) {
                            map.setCenter(latLng);
                            map.setZoom(12);
                            searchMarker.setPosition(latLng);
                            searchMarker.setMap(map);
                            searchMarker.setIcon('../SMARTSTUDIO/img/icons/tags/search-tag.png');
                            let infoWindow = new google.maps.InfoWindow({
                                content: '<div class="marker-info-container">' +
                                    '<img src="../SMARTSTUDIO/img/icons/login-icon.png" class="tag-info-icon">' +
                                    '<p class="text-center font-large font-bold color-darkcyan">' + newTag.name.toUpperCase() + '</p>' +
                                    '<div><p class="float-left">Latitude: </p><p class="float-right">' + newTag.gps_north_degree + '</p></div>' +
                                    '<div class="clear-float"><p class="float-left">Longitude: </p><p class="float-right">' + newTag.gps_east_degree + '</p></div>' +
                                    '</div>'
                            });

                            searchMarker.addListener('mouseover', function () {
                                infoWindow.open(map, this);
                            });

                            searchMarker.addListener('mouseout', function () {
                                infoWindow.close(map, this);
                            });
                        }
                    );
                }
            }
        });

        $scope.$watch('switch.mapFullscreen', function (newValue) {
            if (newValue) {
                openFullScreen(document.querySelector('#map-div'));
                $scope.switch.mapFullscreen = false;
            }
        });
    }

    /**
     * Funciton that handles the change password request
     * @type {string[]}
     */
    recoverPassController.$inject = ['$scope', '$state', 'recoverPassService', '$location'];

    function recoverPassController($scope, $state, recoverPassService, $location) {
        $scope.email          = '';
        $scope.code           = '';
        $scope.username       = '';
        $scope.password       = '';
        $scope.rePassword     = '';
        $scope.error          = '';
        $scope.errorHandeling = {noConnection: false, wrongData: false, passwordNotMatch: false};

        $scope.sendRecoverPassword = function (form) {
            form.$submitted                    = 'true';
            $scope.errorHandeling.noConnection = false;
            $scope.errorHandeling.wrongData    = false;

            let promise = recoverPassService.recoverPassword($scope.email);

            promise.then(
                function (response) {
                    if (response.data.response) {
                        $state.go('recover-password-code');
                    } else {
                        $scope.errorHandeling.wrongData = true;
                    }
                }
            ).catch(
                function () {
                    $scope.errorHandeling.noConnection = true;
                }
            )
        };

        $scope.resetPassword = function (form) {
            form.$submitted                        = 'true';
            $scope.errorHandeling.noConnection     = false;
            $scope.errorHandeling.wrongData        = false;
            $scope.errorHandeling.passwordNotMatch = false;

            if ($scope.password !== $scope.rePassword) {
                $scope.errorHandeling.passwordNotMatch = true;
            } else {

                let promise = recoverPassService.resetPassword($scope.code, $scope.username, $scope.password, $scope.rePassword);

                promise.then(
                    function (response) {
                        if (response.data.response) {
                            $state.go('login');
                        } else {
                            $scope.errorHandeling.wrongData = true;
                            $scope.error                    = response.data.message;
                        }
                    }
                ).catch(
                    function () {
                        $scope.errorHandeling.noConnection = true;
                    }
                )
            }
        }
    }
})();
