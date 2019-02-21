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
    main.controller('registryController', registryController);
    main.controller('anchorsController', anchorsController);
    main.controller('menuController', menuController);

    /**
     * Function that manage the user login functionalities
     * @type {string[]}
     */
    loginController.$inject = ['$scope', '$location', 'socketService', '$state'];

    function loginController($scope, $location, socketService, $state) {
        $scope.user           = {username: '', password: ''};
        $scope.errorHandeling = {noConnection: false, wrongData: false};

        // function that makes the log in of the user
        $scope.login = function (form) {
            form.$submitted = 'true';

            console.log('logging in');
            socketService.sendRequest('login', {username: $scope.user.username, password: $scope.user.password}).then(
                function (response) {
                    if (response.result !== "ERROR_ON_LOGIN") {
                        console.log(response.result);
                        // dataService.username = $scope.user.username;
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

        $scope.recoverPassword = function () {
            $state.go('recover-password');
            // $location.path('/recover-password');
        }
    }

    /**
     * Function that manges the home page functionalities
     * @type {string[]}
     */
    homeController.$inject = ['$scope', '$state', 'NgMap', 'homeData', 'socketService', 'dataService'];

    function homeController($scope, $state, NgMap, homeData, socketService, dataService) {

        let homeCtrl = this;
        let markers  = homeData.markers;
        let bounds   = null;

        homeCtrl.isAdmin = (homeData.isAdmin === 1);

        homeCtrl.mapConfiguration = {
            zoom    : 7,
            map_type: 'TERRAIN',
            center  : [41.87194, 12.56738]
        };

        homeCtrl.dynamicMarkers = [];

        NgMap.getMap('main-map').then(function (map) {

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

            map.addListener('click', function () {
                console.log('double click');
            })
            bounds = new google.maps.LatLngBounds();

            for (let i = 0; i < markers.length; i++) {
                let latLng = new google.maps.LatLng(markers[i].position[0], markers[i].position[1]);

                let marker = new google.maps.Marker({
                    position : latLng,
                    animation: google.maps.Animation.DROP,
                    icon     : '../img/icons/markers/' + ((markers[i].icon) ? markers[i].icon : 'location-marker.png')
                });

                let infoWindow = new google.maps.InfoWindow({
                    content: '<div class="marker-info-container">' +
                        '<img src="../img/icons/login-icon.png" class="tag-info-icon">' +
                        '<p class="text-center font-large font-bold color-darkcyan">' + markers[i].name.toUpperCase() + '</p>' +
                        '<div><p class="float-left">Latitude: </p><p class="float-right">' + markers[i].position[0] + '</p></div>' +
                        '<div class="clear-float"><p class="float-left">Longitude: </p><p class="float-right">' + markers[i].position[1] + '</p></div>' +
                        '</div>'
                })
                marker.addListener('mouseover', function () {

                    console.log('hover marker');
                    infoWindow.open(map, this);
                })

                marker.addListener('mouseout', function () {

                    infoWindow.close(map, this);
                })

                google.maps.event.addDomListener(marker, 'click', function () {
                    socketService.sendRequest('save_location', {location: markers[i].name})
                        .then(function (response) {
                            if (response.result === 'location_saved') {
                                socketService.sendRequest('get_location_info', {})
                                    .then(function (response) {
                                        dataService.location = response.result[0];

                                        if (response.result[0].is_inside)
                                            $state.go('canvas');
                                        else
                                            $state.go('outdoor-location');
                                    })
                            }
                        })
                });

                homeCtrl.dynamicMarkers.push(marker);
                bounds.extend(marker.getPosition());
            }

            homeCtrl.markerClusterer = new MarkerClusterer(map, homeCtrl.dynamicMarkers, {imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});

            map.setCenter(bounds.getCenter());
            map.fitBounds(bounds);
        });

        // $scope.$on('$destroy', function () {
        //     for (let i = 0; i < homeCtrl.dynamicMarkers.length; i++) {
        //         homeCtrl.dynamicMarkers[i].setMap(null);
        //     }
        //     markers = [];
        // })
    }

    /**
     * Function that manages the login map
     * @type {string[]}
     */
    outdoorController.$inject = ['$location', '$scope', '$timeout', '$interval', '$mdDialog', 'NgMap', 'loginService', 'socketService', 'dataService', 'outdoorData'];

    function outdoorController($location, $scope, $timeout, $interval, $mdDialog, NgMap, loginService, socketService, dataService, outdoorData) {
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
                    console.log(locationInfo);

                    return socketService.sendRequest('get_tags_by_location', {location: locationInfo})
                })
                .then(function (response) {
                    tags        = response.result;

                    for (let i = 0; i < tags.length; i++) {
                        let latLng = new google.maps.LatLng(tags[i].gps_north_degree, tags[i].gps_east_degree);
                        let marker = new google.maps.Marker({
                            position : latLng,
                            animation: google.maps.Animation.DROP,
                            icon     : '../img/icons/tags/tag-online-48.png'
                        });

                        let infoContent = '<div class="marker-info-container">' +
                            '<img src="../img/icons/login-icon.png" class="tag-info-icon">' +
                            '<p class="text-center font-large">' + tags[i].name.toUpperCase() + '</p>' +
                            '<div><p class="float-left">Latitude: </p><p class="float-right">' + tags[i].gps_north_degree + '</p></div>' +
                            '<div class="clear-float"><p class="float-left">Longitude: </p><p class="float-right">' + tags[i].gps_east_degree + '</p></div>' +
                            '</div>';

                        if (isOutdoor(tags[i]) && (new Date(Date.now()) - (new Date(tags[i].gps_time)) < tags[i].sleep_time_outdoor)) {
                            console.log(tags[i]);

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
                        console.log(dataService.location);
                        let latLng = new google.maps.LatLng(dataService.location.latitude, dataService.location.longitude);
                        console.log(latLng);
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
                        console.log(tags);
                        for (let i = 0; i < tags.length; i++) {
                            let latLng = new google.maps.LatLng(tags[i].gps_north_degree, tags[i].gps_east_degree);

                            let marker = new google.maps.Marker({
                                position : latLng,
                                animation: google.maps.Animation.DROP,
                                icon     : '../img/icons/tags/tag-online-48.png'
                            });

                            let infoContent = '<div class="marker-info-container">' +
                                '<img src="../img/icons/login-icon.png" class="tag-info-icon">' +
                                '<p class="text-center font-large">' + tags[i].name.toUpperCase() + '</p>' +
                                '<div><p class="float-left">Latitude: </p><p class="float-right">' + tags[i].gps_north_degree + '</p></div>' +
                                '<div class="clear-float"><p class="float-left">Longitude: </p><p class="float-right">' + tags[i].gps_east_degree + '</p></div>';

                            console.log(isOutdoor(tags[i]));
                            console.log(new Date(Date.now()) - (new Date(tags[i].gps_time)) < tags[i].sleep_time_outdoor);
                            if (isOutdoor(tags[i]) && (new Date(Date.now()) - (new Date(tags[i].gps_time)) < tags[i].sleep_time_outdoor)) {
                                console.log('show marker ok');
                                setIcon(tags[i], marker);

                                // marker.addListener('mouseover', function () {
                                //     let infoWindow = new google.maps.InfoWindow({
                                //         content: infoContent
                                //     });
                                //
                                //     infoWindow.open(map, marker);
                                // });

                                if (checkAlarms(tags[i])) {
                                    console.log('marker ok with alarms');
                                    if (markerIsOnMap(dynamicTags, marker)) {
                                        console.log('marker is on the map');
                                        for (let m = 0; m < dynamicTags.length; m++) {
                                            if (dynamicTags[m].getPosition().equals(marker.getPosition())) {
                                                console.log('same position');
                                                console.log(marker.getIcon());
                                                console.log(dynamicTags[m].getIcon());
                                                if (marker.getIcon() !== dynamicTags[m].getIcon()) {
                                                    console.log('different icons');
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
                                        console.log('marker is on map');
                                        console.log(marker.getIcon());
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
                                console.log('show marker not');
                                if (checkAlarms(tags[i])) {
                                    console.log('alarms on');
                                    setIcon(tags[i], marker);

                                    // marker.addListener('click', function () {
                                    //     let infoWindow = new google.maps.InfoWindow({
                                    //         content: infoContent
                                    //     });
                                    //
                                    //     infoWindow.open(map, marker);
                                    // });

                                    if (markerIsOnMap(dynamicTags, marker)) {
                                        console.log('marker on the map');
                                        console.log()
                                        for (let m = 0; m < dynamicTags.length; m++) {
                                            if (dynamicTags[m].getPosition().equals(marker.getPosition())) {
                                                if (marker.getIcon() !== dynamicTags[m].getIcon()) {
                                                    dynamicTags[m].setMap(null);
                                                    dynamicTags.splice(m, 1);
                                                }
                                            }
                                        }
                                    } else {
                                        console.log('pushing marker');
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
                marker.setIcon('../img/icons/tags/sos.png');
            } else if (tag.battery_status) {
                marker.setIcon('../img/icons/tags/battery-empty.png');
            } else if (tag.man_down) {
                marker.setIcon('../img/icons/tags/man-down.png');
            } else if (tag.man_down_disabled) {
                marker.setIcon('../img/icons/tags/man-down-disabled.png');
            } else if (tag.man_down_tacitated) {
                marker.setIcon('../img/icons/tags/man-down-tacitated.png');
            } else if (tag.man_in_quote) {
                marker.setIcon('../img/icons/tags/man-in-quote.png');
            } else if (tag.call_me_alarm) {
                marker.setIcon('../img/icons/tags/call-me.png');
            } else if (tag.diagnostic_request) {
                marker.setIcon('../img/icons/tags/diagnostic-request.png');
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
                            '<img src="../img/icons/login-icon.png" class="tag-info-icon">' +
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
                templateUrl        : '../components/outdoor-alarms-info.html',
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
                                image      : '../img/icons/tags/sos.png'
                            };
                        }
                        if (tags[i].battery_status) {
                            $scope.alarms['battery_status_' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Batteria scarica',
                                description: 'La batteria e\' scarica.',
                                image      : '../img/icons/tags/battery-empty.png'
                            };
                        }
                        if (tags[i].man_down) {
                            $scope.alarms['man_down_' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Uomo a terra',
                                description: 'Uomo a terra, mandare soccorso',
                                image      : '../img/icons/tags/man-down.png'
                            };
                        }
                        if (tags[i].man_down_disabled) {
                            $scope.alarms['man_down_disabled_' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Uomo a terra disabilitato',
                                description: 'Uomo a terra disabilitato',
                                image      : '../img/icons/tags/man-down-disabled.png'
                            };
                        }
                        if (tags[i].man_down_tacitated) {
                            $scope.alarms['man_down_tacitated_' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Man down tacitated',
                                description: 'Man down tacitated.',
                                image      : '../img/icons/tags/man-down-tacitated.png'
                            };
                        }
                        if (tags[i].man_in_quote) {
                            $scope.alarms['man_in_quote' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Man in quote',
                                description: 'Man in quote.',
                                image      : '../img/icons/tags/man-in-quote.png'
                            };
                        }
                        if (tags[i].call_me_alarm) {
                            $scope.alarms['call_me_alarm_' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Call_me_alarm',
                                description: 'Call me alarm.',
                                image      : '../img/icons/tags/call-me-alarm.png'
                            };
                        }
                        if (tags[i].diagnostic_request) {
                            $scope.alarms['diagnostic_request' + tags[i].name] = {
                                tag        : tags[i].name,
                                name       : 'Diagnostic request',
                                description: 'Diagnostic request.',
                                image      : '../img/icons/tags/diagnostic-request.png'
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
            console.log('offline tags clicked');
            $mdDialog.show({
                locals             : {tags: tags},
                templateUrl        : '../components/show-offline-tags.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'tags', function ($scope, tags) {

                    $scope.offlineTags = {};

                    for (let i = 0; i < tags.length; i++) {
                        if ((tags[i].gps_north_degree !== 0 && tags[i].gps_east_degree !== 0) && (new Date(Date.now()) - (new Date(tags[i].gps_time)) > tags[i].sleep_time_outdoor)) {
                            $scope.offlineTags[tags[i].name] = {
                                name : tags[i].name,
                                image: '../img/icons/tags/tag-offline.png'
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
    canvasController.$inject = ['$scope', '$location', '$mdDialog', '$timeout', '$interval', 'canvasService', 'socketService', 'menuService', 'canvasData', 'dataService'];

    function canvasController($scope, $location, $mdDialog, $timeout, $interval, canvasService, socketService, menuService, canvasData, dataService) {
        let canvasCtrl    = this;
        let canvas        = document.querySelector('#canvas-id');
        let context       = canvas.getContext('2d');
        let bufferCanvas  = document.createElement('canvas');
        let bufferContext = bufferCanvas.getContext('2d');
        let canvasImage   = new Image();

        canvasCtrl.floors                 = canvasData.floors;
        canvasCtrl.defaultFloor           = canvasData.floors[0];
        canvasCtrl.showAlarmsIcon         = false;
        canvasCtrl.showOfflineTagsIcon    = false;
        canvasCtrl.showOfflineAnchorsIcon = false;

        //floor initial data
        canvasCtrl.floorData = {
            defaultFloorName: canvasData.floors[0].name,
            gridSpacing     : canvasData.floors[0].map_spacing,
            location        : canvasData.location,
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


        // $scope.isOpen = false;
        // $scope.speedDial = {
        //     isOpen: false,
        //     selectedDirection: 'left',
        //     mode: 'md-scale',
        //     fullscreen: false,
        //     gridSpacing: 0,
        // };

        //watching for changes in switch buttons in menu
        $scope.$watchGroup(['canvasCtrl.switch.showGrid', 'canvasCtrl.switch.showAnchors', 'canvasCtrl.switch.showCameras', 'canvasCtrl.floorData.gridSpacing', 'canvasCtrl.switch.showDrawing'], function (newValues) {
            if (canvasCtrl.defaultFloor.map_spacing !== newValues[3])
                canvasCtrl.defaultFloor.map_spacing = newValues[3];

            //TODO - control if drawing is off, - control if interval is undefined and start it if so, - resetting the switch buttons
            //     - if drawing is on stop the interval and set it to undefined, - reset the switch buttons, - reload canvas

            //THE FACT THAT I AM CALLING HERE UPDATE FLOOR IS CREATING THE GLITCH
            // canvasCtrl.loadFloor(false, false, false)
        });

        //watching the fullscreen switch button
        $scope.$watch('switch.fullscreen', function (newValue) {
            if (newValue) {
                openFullScreen(document.querySelector('#canvas-container'));
                $scope.switch.fullscreen = false;
            }
        });

        //watching the floor selection button
        $scope.$watch('canvasCtrl.floorData.defaultFloorName', function (newValue) {
            canvasCtrl.defaultFloor = canvasCtrl.floors.filter(f => {
                return f.name === newValue
            })[0];
        });

        //function that loads the floor map and starts the contrant update of the floor
        canvasCtrl.loadFloor = function () {
            let img = new Image();
            img.src = imagePath + 'floors/' + canvasCtrl.defaultFloor.image_map;

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
                                    (checkIfTagsHaveAlarms(value))
                                        ? img.src = tagsIconPath + 'cumulative_tags_all_alert_32.png'
                                        : img.src = tagsIconPath + 'cumulative_tags_32.png';
                                } else {
                                    if (checkIfTagHasAlarm(value[0])) {
                                        assigningTagImage(value[0], img);
                                    } else if (value[0].is_exit && !value[0].radio_switched_off) {
                                        img.src = tagsIconPath + 'offline_tag_24.png';
                                    } else if (!value[0].is_exit && !value[0].radio_switched_off) {
                                        assigningTagImage(value[0], img);
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

        //check if there is at least a tag with an alarm
        let checkIfTagsHaveAlarms = function (tags) {
            return tags.some(function (tag) {
                return tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                    || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                    || tag.call_me_alarm || tag.diagnostic_request
            });
        };

        //checking if the tag has an alarm
        let checkIfTagHasAlarm = function (tag) {
            return tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                || tag.call_me_alarm || tag.diagnostic_request;
        };

        //checking if there is at least an anchor offline
        let checkIfAnchorsAreOffline = function (anchors) {
            return anchors.some(function (anchor) {
                return anchor.is_online !== true;
            });
        };

        //constantly updating the canvas with the objects position from the server
        let constantUpdateCanvas = function () {
            $interval(function () {
                canvasImage.src = imagePath + 'floors/' + canvasCtrl.defaultFloor.image_map;

                canvasImage.onload = function () {
                    bufferCanvas.width  = this.naturalWidth;
                    bufferCanvas.height = this.naturalHeight;

                    //updating the canvas and drawing border
                    updateCanvas(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasImage);

                    if (canvasCtrl.switch.showGrid) {
                        //drawing vertical
                        drawDashedLine(bufferCanvas, bufferContext, canvas.height, [5, 5], canvasCtrl.defaultFloor.map_spacing, canvasCtrl.defaultFloor.width, 'vertical');
                        //drawing horizontal lines
                        drawDashedLine(bufferCanvas, bufferContext, canvas.width, [5, 5], canvasCtrl.defaultFloor.map_spacing, canvasCtrl.defaultFloor.width, 'horizontal');
                    }

                    socketService.sendRequest('get_anchors_by_floor_and_location', {
                        floor   : canvasCtrl.floorData.defaultFloorName,
                        location: dataService.location
                    })
                    //managing the anchors visualizzation
                        .then(function (response) {
                            dataService.anchors = response.result;
                            loadAndDrawImagesOnCanvas(response.result, 'anchor', canvasCtrl.switch.showAnchors);

                            canvasCtrl.showOfflineAnchorsIcon = checkIfAnchorsAreOffline(response.result);

                            return socketService.sendRequest('get_cameras_by_floor_and_location', {
                                floor   : canvasCtrl.floorData.defaultFloorName,
                                location: dataService.location
                            })
                        })
                        //managing the cameras visualizzation
                        .then(function (response) {
                            // dataService.cameras = response.result;

                            loadAndDrawImagesOnCanvas(response.result, 'camera', canvasCtrl.switch.showCameras);

                            return socketService.sendRequest('get_tags_by_floor_and_location', {floor: canvasCtrl.defaultFloor.id, location: dataService.location});
                        })
                        //managing the tags visualizzation
                        .then(function (response) {
                            dataService.tags = response.result;

                            let tagClouds            = [];
                            let isolatedTags         = [];
                            let singleAndGroupedTags = [];
                            let step                 = 0;
                            let temporaryTagsArray                 = {
                                singleTags: angular.copy(response.result),
                            }

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
                                            drawIcon(tagClouds[index][0], bufferContext, image, canvasCtrl.defaultFloor.width, bufferCanvas, true);
                                        });
                                    }

                                    return loadImagesAsynchronouslyWithPromise(isolatedTags, 'tag');
                                })
                                .then(function (images) {
                                    if (images !== null) {
                                        //drawing the isolated tags
                                        isolatedTags.forEach(function (tag, index) {
                                            if (tag[0].gps_north_degree === 0 && tag[0].gps_east_degree === 0) {
                                                if (tag[0].tag_type_id === 1) {
                                                    if (!(tag[0].is_exit && tag[0].radio_switched_off)) {
                                                        drawIcon(tag[0], bufferContext, images[index], canvasCtrl.defaultFloor.width, bufferCanvas, true);
                                                    }
                                                } else {
                                                    if (checkIfTagHasAlarm(tag[0])) {
                                                        drawIcon(tag[0], bufferContext, images[index], canvasCtrl.defaultFloor.width, bufferCanvas, true);
                                                    } else if ((new Date(Date.now()) - (new Date(tag[0].gps_time)) < tag[0].sleep_time_indoor)) {
                                                        drawIcon(tag[0], bufferContext, images[index], canvasCtrl.defaultFloor.width, bufferCanvas, true);
                                                    }
                                                }
                                            }
                                        })
                                    }
                                    context.drawImage(bufferCanvas, 0, 0);
                                });

                            //showing the offline anchors and alarm button
                            canvasCtrl.showOfflineTagsIcon = isTagOffline(response.result);
                            canvasCtrl.showAlarmsIcon      = checkIfTagsHaveAlarms(response.result);
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
                            drawIcon(objects[index], bufferContext, image, canvasCtrl.defaultFloor.width, bufferCanvas, false);
                        })
                    }
                )
            }
        };

        //grouping the tags in one object divided by clouds of tags and single tags
        let groupNearTags = function (tags, tag) {
            let tagsGrouping = {
                groupTags: [],
                singleTags : []
            };

            tags.forEach(function (tagElement) {
                if (tagElement.x_pos - 20 < tag.x_pos && tag.x_pos < tagElement.x_pos + 20
                    || (tagElement.y_pos - 20 < tag.y_pos && tag.y_pos < tagElement.y_pos)) {
                    if (tagElement.tag_type_id !== 1) {
                        if (checkIfTagHasAlarm(tagElement) || (new Date(Date.now()) - (new Date(tagElement.gps_time))) < tagElement.sleep_time_indoor) {
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

        let isTagOffline = function (tags) {
            return tags.some(function (tag) {
                return tag.is_exit && !tag.radio_switched_off;
            })
        };

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
        }

        //creating the informations to be shown on the info window of the canvas objects
        let createAlarmObjectForInfoWindow = function(tag, name, description, image){
            return {
                tag        : tag.name,
                name       : name,
                description: description,
                image      : image
            };
        };

        //getting all the alarms of the tag passed as parameter and creating the objects to be shown in info window
        let loadTagAlarmsForInfoWindow = function(tag){
            let alarms = [];

            if (tag.sos){
                alarms.push(createAlarmObjectForInfoWindow(tag, 'SOS', 'Richiesta di aiuto.', tagsIconPath + 'sos_24.png'));
            }
            if (tag.man_down) {
                alarms.push(createAlarmObjectForInfoWindow(tag, 'Uomo a terra', 'Uomo a terra.', tagsIconPath + 'man_down_24.png'));
            }
            if (tag.battery_status) {
                alarms.push(createAlarmObjectForInfoWindow(tag, 'Batteria scarica', 'La batteria e\' scarica.', tagsIconPath + 'battery_low_24.png'));
            }
            if (tag.helmet_dpi){
                alarms.push(createAlarmObjectForInfoWindow(tag, 'Helmet dpi', 'Helmet dpi', tagsIconPath + 'helmet_dpi_24.png'));
            }
            if (tag.belt_dpi){
                alarms.push(createAlarmObjectForInfoWindow(tag, 'Belt dpi', 'Belt dpi', tagsIconPath + 'belt_dpi_24.png'));
            }
            if (tag.glove_dpi){
                alarms.push(createAlarmObjectForInfoWindow(tag, 'Glove dpi', 'Glove dpi', tagsIconPath + 'glove_dpi_24.png'));
            }
            if (tag.shoe_dpi){
                alarms.push(createAlarmObjectForInfoWindow(tag, 'Shoe dpi', 'Shoe dpi', tagsIconPath + 'shoe_dpi_24.png'));
            }
            if (tag.man_down_disabled){
                alarms.push(createAlarmObjectForInfoWindow(tag, 'Man down disabled', 'Man down disabled', tagsIconPath + 'man_down_disbled_24.png'));
            }
            if (tag.man_down_tacitated) {
                alarms.push(createAlarmObjectForInfoWindow(tag, 'man down tacitated', 'Man down tacitated', tagsIconPath + 'man_down_tacitated_24.png'));
            }
            if (tag.man_in_quote) {
                alarms.push(createAlarmObjectForInfoWindow(tag, 'Man in quote', 'Man in quote', tagsIconPath + 'man_in_quote_24.png'));
            }
            if (tag.call_me_alarm) {
                alarms.push(createAlarmObjectForInfoWindow(tag, 'Call me alarm', 'Call me alarm', tagsIconPath + 'call_me_alarm_24.png'));
            }

            return alarms;
        };

        //adding the mousedown listener to the canvas
        canvas.addEventListener('mousedown', function (event) {
            let coords = canvas.canvasMouseClickCoords(event);
            let tagCloud = null;
            let dialogShown = false;
            //listen for the tags click
            dataService.tags.forEach(function (tag) {
                tagCloud = groupNearTags(dataService.tags, tag);
                console.log(tagCloud);
                if (tagCloud.groupTags.length > 0){
                    console.log(tagCloud.groupTags)
                }
                if (tag.gps_north_degree === 0 || tag.gps_east_degree === 0) {
                    if (((tag.x_pos - 20) < coords.x && coords.x < (tag.x_pos + 20)) && ((tag.y_pos - 20) < coords.y && coords.y < (tag.y_pos + 20))) {
                        if (tagCloud.groupTags.length > 1){
                            if (!dialogShown) {
                                $mdDialog.show({
                                    locals             : {tags: tagCloud.groupTags},
                                    templateUrl        : '../components/tags-info.html',
                                    parent             : angular.element(document.body),
                                    targetEvent        : event,
                                    clickOutsideToClose: true,
                                    controller         : ['$scope', 'tags', function ($scope, tags) {
                                        $scope.tags         = tags;
                                        $scope.isTagInAlarm = 'background-red';
                                        $scope.alarms       = loadTagAlarmsForInfoWindow(tag);

                                        console.log('loaded alarmas');
                                        console.log($scope.alarms);
                                        $scope.hide = function () {
                                            $mdDialog.hide();
                                        }
                                    }]
                                })
                            }
                            dialogShown = true;
                        }else{
                            if (tag.tag_type_id === 1) {
                                if (!(tag.is_exit && tag.radio_switched_off)) {
                                    $mdDialog.show({
                                        locals             : {tag: tag},
                                        templateUrl        : '../components/tag-info.html',
                                        parent             : angular.element(document.body),
                                        targetEvent        : event,
                                        clickOutsideToClose: true,
                                        controller         : ['$scope', 'tag', function ($scope, tag) {
                                            $scope.tag     = tag;
                                            $scope.isTagInAlarm = 'background-red';
                                            $scope.alarms  = loadTagAlarmsForInfoWindow(tag);

                                            if ($scope.alarms.length === 0){
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
                            } else if (checkIfTagHasAlarm(tag) || (new Date(Date.now()) - (new Date(tag.gps_time)) < tag.sleep_time_indoor)) {
                                $mdDialog.show({
                                    locals             : {tag: tag},
                                    templateUrl        : '../components/tag-info.html',
                                    parent             : angular.element(document.body),
                                    targetEvent        : event,
                                    clickOutsideToClose: true,
                                    controller         : ['$scope', 'tag', function ($scope, tag) {
                                        $scope.tag     = tag;
                                        $scope.isTagInAlarm = 'background-red';
                                        $scope.alarms  = loadTagAlarmsForInfoWindow(tag);

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
                    if (((anchor.x_pos - 20) < coords.x && coords.x < (anchor.x_pos + 20)) && ((anchor.y_pos - 20) < coords.y && coords.y < (anchor.y_pos + 20))) {
                        $mdDialog.show({
                            locals             : {anchor: anchor},
                            templateUrl        : '../components/anchor-info.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            controller         : ['$scope', 'anchor', function ($scope, anchor) {
                                $scope.anchor         = anchor;
                                $scope.isAnchorOnline = 'background-green';

                                if (!anchor.is_online) {
                                    $scope.isOnline = 'background-gray';
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
                if(!isTagAtCoords(coords)) {
                    if (((camera.x_pos - 20) < coords.x && coords.x < (camera.x_pos + 20)) && ((camera.y_pos - 20) < coords.y && coords.y < (camera.y_pos + 20))) {
                        console.log(camera.description);
                    }
                }
            });
        }, false);

        //showing the info window with all the alarms
        $scope.showAlarms = function () {
            $mdDialog.show({
                locals             : {tags: dataService.tags},
                templateUrl        : '../components/indoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'tags', function ($scope, tags) {
                    $scope.alarms = [];

                    tags.forEach(function (tag) {
                        let tagAlarms = loadTagAlarmsForInfoWindow(tag);
                        tagAlarms.forEach(function (tagAlarm) {
                            $scope.alarms.push(tagAlarm);
                        })
                    });

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        let isTagAtCoords = function(coords) {
            return dataService.tags.some(function (tag) {
                return (tag.gps_north_degree === 0 || tag.gps_east_degree === 0) && (((tag.x_pos - 20) < coords.x && coords.x < (tag.x_pos + 20)) && ((tag.y_pos - 20) < coords.y && coords.y < (tag.y_pos + 20)));
            })
        }

        //showing the info window with the online/offline tags
        $scope.showOfflineTagsIndoor = function () {
            $mdDialog.show({
                locals: {defaultFloor: canvasCtrl.defaultFloor.id},
                templateUrl        : '../components/indoor_offline_tags_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'defaultFloor', 'socketService', function ($scope, defaultFloor, socketService) {

                    $scope.offlineTagsIndoor = [];

                    $scope.tagsStateIndoor = {
                        offline: 0,
                        online : 0
                    };

                    $scope.colors = ["#D3D3D3", "#4BAE5A"];
                    $scope.labels = ["Tags disativati", "Tag attivi"];

                    let interval = undefined;
                    interval = $interval(function () {
                        socketService.sendRequest('get_tags_by_floor_and_location', {
                            floor   : defaultFloor,
                            location: dataService.location
                        })
                            .then(function (response) {

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

        //showing the info window with the online/offline anchors
        $scope.showOfflineAnchorsIndoor = function () {
            $mdDialog.show({
                locals             : {floor: canvasCtrl.defaultFloor.name},
                // templateUrl        : '../components/show-offline-tags.html',
                templateUrl        : '../components/indoor_offline_anchors_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'floor', 'dataService', function ($scope, floor, dataService) {

                    $scope.offlineAnchors = [];

                    $scope.anchorsState = {
                        offline: 0,
                        online : 0
                    };

                    $scope.colors = ["#D3D3D3", "#4BAE5A"];
                    $scope.labels = ["Ancore disativate", "Ancore attive"];

                    let interval = undefined;
                    interval = $interval(function () {
                        socketService.sendRequest('get_anchors_by_floor_and_location', {
                            floor   : floor,
                            location: dataService.location
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

        $scope.showEmergencyZone = function () {
            $mdDialog.show({
                locals             : {floor: canvasCtrl.defaultFloor.name, tags: dataService.tags},
                templateUrl        : '../components/emergency-alarm-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'floor', 'tags', function ($scope, floor, tags) {
                    $scope.safeTags   = null;
                    $scope.unsafeTags = [];

                    $scope.men    = {
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
        }
    }

    menuController.$inject = ['$scope', '$mdDialog', '$mdEditDialog', '$location', '$state', '$filter', '$timeout', '$mdSidenav', 'NgMap', 'dataService', 'menuService', 'socketService'];
    function menuController($scope, $mdDialog, $mdEditDialog, $location, $state, $filter, $timeout, $mdSidenav, NgMap, dataService, menuService, socketService) {

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
                templateUrl        : '../components/insert-location.html',
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
                                            console.log('image not inserted');
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
                                console.log(error);
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
                templateUrl        : '../components/history.html',
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
                                console.log(response);
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

                                    if ($scope.historyRows.length === 0) {
                                        $scope.tableEmpty = true;
                                    } else {
                                        $scope.tableEmpty = false;
                                    }
                                    $scope.$apply();
                                }
                            );
                    });

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]

            });
        };

        $scope.changePassword = function () {
            $mdDialog.show({
                templateUrl        : '../components/change-password.html',
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
                templateUrl        : '../components/change-registry.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected     = [];
                    $scope.limitOptions = [5, 10, 15];
                    $scope.tags = [];
                    $scope.query = {
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
                templateUrl        : '../components/anchors.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected     = [];
                    $scope.limitOptions = [5, 10, 15];

                    $scope.query = {
                        order: 'name',
                        limit: 5,
                        page : 1
                    };

                    socketService.sendRequest('get_anchors_by_location', {location: dataService.location})
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
                templateUrl        : '../components/floor-settings.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected     = [];
                    $scope.limitOptions = [5, 10, 15];

                    $scope.query = {
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
                                    console.log(floorName);
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
                            console.log($scope.floorId);
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
            if (newValue !== '') {
                let newTag = $filter('filter')(dataService.tags, newValue)[0];
                let oldTag = $filter('filter')(dataService.tags, oldValue)[0];
                if (newTag.gps_north_degree === 0 && newTag.gps_east_degree === 0) {
                    //TODO mostrare tag su canvas
                    $mdDialog.show({
                        locals             : {tags: dataService.tags, outerScope: $scope},
                        templateUrl        : '../components/search-tag-inside.html',
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
                                        tagImg.src = imagePath + 'icons/tags/tag-online.png';

                                        tagImg.onload = function () {
                                            console.log(tagImg);
                                            drawIcon(tag, context, tagImg, response.result[0].width, canvas, true);
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
                            searchMarker.setIcon('../img/icons/tags/search-tag.png');
                            let infoWindow = new google.maps.InfoWindow({
                                content: '<div class="marker-info-container">' +
                                    '<img src="../img/icons/login-icon.png" class="tag-info-icon">' +
                                    '<p class="text-center font-large font-bold color-darkcyan">' + newTag.name.toUpperCase() + '</p>' +
                                    '<div><p class="float-left">Latitude: </p><p class="float-right">' + newTag.gps_north_degree + '</p></div>' +
                                    '<div class="clear-float"><p class="float-left">Longitude: </p><p class="float-right">' + newTag.gps_east_degree + '</p></div>' +
                                    '</div>'
                            })

                            searchMarker.addListener('mouseover', function () {
                                infoWindow.open(map, this);
                            })

                            searchMarker.addListener('mouseout', function () {
                                infoWindow.close(map, this);
                            })
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

    registryController.$inject = ['$scope', '$mdDialog', '$timeout', 'socketService'];

    function registryController($scope, $mdDialog, $timeout, socketService) {

    }

    anchorsController.$inject = ['$scope', '$mdDialog', '$mdEditDialog', 'socketService'];

    function anchorsController($scope, $mdDialog, $mdEditDialog, socketService) {

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
