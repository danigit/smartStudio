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
    main.controller('languageController', languageController);

    /**
     * Function that manage the user login functionalities
     * @type {string[]}
     */
    loginController.$inject = ['$scope', 'socketService', '$state', '$timeout'];

    function loginController($scope, socketService, $state, $timeout) {
        $scope.user           = {username: '', password: ''};
        $scope.errorHandeling = {noConnection: false, wrongData: false, socketClosed: socketService.socketClosed};
        let socket = socketService.getSocket();

        // function that makes the log in of the user
        $scope.login = (form) => {
            form.$submitted = 'true';
            if ($scope.user.username !== '' && $scope.user.password !== '') {

                let id = ++requestId;
                socket.send(encodeRequestWithId(id, 'login', {username: $scope.user.username, password: $scope.user.password}));
                socket.onmessage = (response) => {
                    let parsedResponse = parseResponse(response);
                    if (parsedResponse.id === id) {
                        if (parsedResponse.result.id !== undefined) {
                            document.cookie = "username=" + $scope.user.username;
                            $state.go('home');
                        } else {
                            $scope.errorHandeling.noConnection = false;
                            $scope.errorHandeling.wrongData    = true;
                        }
                        $scope.$apply();
                    }
                };

                socket.onerror = () => {
                    $scope.errorHandeling.wrongData    = false;
                    $scope.errorHandeling.noConnection = true;
                }
            }
        };

        //change the page to the recover password page
        $scope.recoverPassword = () => {
            $state.go('recover-password');
        }
    }

    /**
     * Function that manges the home page functionalities
     * @type {string[]}
     */
    homeController.$inject = ['$rootScope', '$scope', '$state', '$mdDialog', '$interval', '$timeout', 'NgMap', 'homeData', 'socketService', 'dataService'];

    function homeController($rootScope, $scope, $state, $mdDialog, $interval, $timeout, NgMap, homeData, socketService, dataService) {
        let homeCtrl = this;

        let socket = socketService.getSocket();
        let markers  = homeData.markers;
        let bounds   = new google.maps.LatLngBounds();
        let tags     = dataService.allTags;
        let allarmZoom = undefined;
        let controllerMap = null;
        let alarmLocations = [];
        let indoorTags = [];
        let imageIndex = 0;
        let alarmLocationsLength = 0;
        let zoomSetted = 0;

        //visualizing the data according if the user is admin or not
        homeCtrl.isAdmin = dataService.isAdmin;
        homeCtrl.isUserManager = dataService.isUserManager;

        homeCtrl.dynamicMarkers   = [];

        homeCtrl.mapConfiguration = {
            zoom    : mapZoom,
            map_type: mapType,
            center  : mapCenter
        };

        //controlling if the user has already changed the default password
        if (!homeData.password_changed){
            $mdDialog.show({
                locals: {password_changed: homeData.password_changed},
                templateUrl        : componentsPath + 'change-password.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                controller         : ['$scope', 'password_changed', function ($scope, password_changed) {

                    $scope.title = lang.changePassword.toUpperCase();

                    $scope.changePassword = {
                        oldPassword  : '',
                        newPassword  : '',
                        reNewPassword: '',
                        resultClass  : '',
                        showSuccess  : false,
                        showError    : false,
                        message      : false
                    };

                    $scope.sendPassword = (form) => {
                        form.$submitted = true;

                        if ($scope.changePassword.newPassword !== $scope.changePassword.reNewPassword) {
                            $scope.changePassword.resultClass = 'background-red';
                            $scope.changePassword.showError   = true;
                            $scope.changePassword.showSuccess = false;
                            $scope.changePassword.message     = lang.passwordNotEqual;
                        } else {
                            if (form.$valid) {
                                let id = ++requestId;
                                socket.send(encodeRequestWithId(id, 'change_password', {
                                    oldPassword: $scope.changePassword.oldPassword,
                                    newPassword: $scope.changePassword.newPassword
                                }));

                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    if (parsedResponse.id === id){
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        if (parsedResponse.result === 'wrong_old') {
                                            $scope.changePassword.resultClass = 'background-red';
                                            $scope.changePassword.showError   = true;
                                            $scope.changePassword.showSuccess = false;
                                            $scope.changePassword.message     = lang.oldPasswordNotValid;
                                        } else if (parsedResponse.result === 'error_on_changing_password') {
                                            $scope.changePassword.resultClass = 'background-red';
                                            $scope.changePassword.showSuccess = false;
                                            $scope.changePassword.showError   = true;
                                            $scope.changePassword.message     = lang.impossibleChangePassword;
                                            $timeout(function () {
                                                $mdDialog.hide();
                                            }, 1000);
                                        } else {
                                            $scope.changePassword.resultClass = 'background-green';
                                            $scope.changePassword.showSuccess = true;
                                            $scope.changePassword.showError   = false;
                                            $scope.changePassword.message     = lang.passwordChanged;
                                            $timeout(function () {
                                                $mdDialog.hide();
                                                window.location.reload();
                                            }, 1000);
                                        }
                                        $scope.$apply();
                                    }
                                };
                            } else {
                                $scope.changePassword.resultClass = 'background-red';
                            }
                        }
                    };

                    $scope.hide = () => {
                        if (password_changed === 1)
                            $mdDialog.hide();
                    }
                }]
            });
        }//the default password has been changed so I show the homescreen
        else {
            dataService.loadUserSettings();

            let getLocationAnchors = (location, anchors) => {
                return anchors.filter(a => (a.location_latitude === location.position[0] && a.location_longitude === location.position[1]));
            };

            let alarmLocationsContainLocation = (alarms, location) => {
                return alarms.some(l => l.position[0] === location.position[0] && l.position[1] === location.position[1])
            };

            let getLocationTags = (location, tags) => {
                return tags.filter(t => dataService.isTagInLocation(t, location));
            };

            let getIndoorLocationTags = (location, tags) => {
                return tags.filter(t => (location.position[0] === t.location_latitude && location.position[1] === t.location_longitude))
            };

            let findTagLocation = (allTags, indoorTags, anchors, map) => {
                let alarmBounds = new google.maps.LatLngBounds();

                markers.forEach((marker) => {
                    let tags           = getLocationTags(marker, allTags);

                    let markerObject   = new google.maps.Marker({
                        position: new google.maps.LatLng(marker.position[0], marker.position[1]),
                    });

                    let markerSelected = homeCtrl.dynamicMarkers.filter(m => m.getPosition().lat() === markerObject.getPosition().lat() && m.getPosition().lng() === markerObject.getPosition().lng())[0];

                    //if the marker is inside it cannot be an anchor i alarm
                    if (!marker.is_inside) {
                        if (dataService.checkIfTagsHaveAlarms(tags)) {
                            if (!alarmLocationsContainLocation(alarmLocations, marker)) {
                                alarmLocations.push(marker);
                            }
                            if (imageIndex === 0){
                                markerSelected.setIcon(markersIconPath + 'location-marker.png');
                            }else {
                                console.log(imageIndex);
                                markerSelected.setIcon(iconsPath + 'alarm-icon.png');
                            }
                        } else {
                            if (alarmLocationsContainLocation(alarmLocations, marker)) {
                                alarmLocations = alarmLocations.filter(l => !angular.equals(l.position, marker.position));
                                markerSelected.setIcon(markersIconPath + ((marker.icon) ? marker.icon : 'location-marker.png'));
                            }
                        }
                    }//I control if the anchors have alarm
                    else {
                        let locationAnchors = getLocationAnchors(marker, anchors);
                        let locationTags    = getIndoorLocationTags(marker, indoorTags);

                        if (dataService.checkIfTagsHaveAlarms(locationTags)) {
                            if (!alarmLocationsContainLocation(alarmLocations, marker)) {
                                alarmLocations.push(marker);
                            }
                            if (imageIndex === 0)
                                markerSelected.setIcon(iconsPath + 'alarm-icon.png');
                            else
                                markerSelected.setIcon(markersIconPath + 'location-marker.png');
                        } else if (!dataService.checkIfAnchorsHaveAlarms(locationAnchors)) {
                            if (alarmLocationsContainLocation(alarmLocations, marker)) {
                                alarmLocations = alarmLocations.filter(l => !angular.equals(l.position, marker.position));
                                markerSelected.setIcon(markersIconPath + ((marker.icon) ? marker.icon : 'location-marker.png'));
                            }
                        }

                        if (dataService.checkIfAnchorsHaveAlarms(locationAnchors) || dataService.checkIfAreAnchorsOffline(locationAnchors)) {
                            if (!alarmLocationsContainLocation(alarmLocations, marker)) {
                                alarmLocations.push(marker);
                            }
                            if (imageIndex === 1)
                                markerSelected.setIcon(iconsPath + 'offline_anchors_alert_64.png');
                        }
                    }
                });


                //resizing the zoom of the map to see only the locations in alarm
                if (alarmLocations.length > 0 && alarmLocations.length !== alarmLocationsLength) {
                    alarmLocations.forEach(location => {
                        alarmBounds.extend(new google.maps.LatLng(location.position[0], location.position[1]))
                    });

                    map.fitBounds(alarmBounds);

                    if (allarmZoom !== map.getZoom()) {
                        allarmZoom = map.getZoom();
                    }

                    alarmLocationsLength = alarmLocations.length;
                }

                imageIndex++;
                if (imageIndex === 2)
                    imageIndex = 0;
            };

            //function that updates the alert notifications
            let constantUpdateNotifications = (map) => {
                dataService.homeTimer = $interval(() => {
                    console.log('inside home timer');

                    let id1 = ++requestId;
                    let id2 = -1, id3 = -1, id4 = -1;

                    socket.send(encodeRequestWithId(id1, 'get_all_tags'));
                    socket.onmessage = (response) => {
                        let parsedResponse = parseResponse(response);
                        if (parsedResponse.id === id1) {
                            if (parsedResponse.session_state)
                                window.location.reload();

                            tags                         = parsedResponse.result;
                            homeCtrl.showAlarmsIcon      = dataService.checkIfTagsHaveAlarms(parsedResponse.result);
                            homeCtrl.showOfflineTagsIcon = dataService.checkIfTagsAreOffline(parsedResponse.result);

                            dataService.playAlarmsAudio(parsedResponse.result);

                            id2 = ++requestId;
                            socket.send(encodeRequestWithId(id2, 'get_tags_by_user', {user: dataService.user.username}));
                        }else if(parsedResponse.id === id2){
                            if (parsedResponse.session_state)
                                window.location.reload();

                            indoorTags = parsedResponse.result;

                            id3 = ++requestId;
                            socket.send(encodeRequestWithId(id3, 'get_anchors_by_user', {user: dataService.user.username}));
                        }else if(parsedResponse.id === id3){
                            if (parsedResponse.session_state)
                                window.location.reload();

                            findTagLocation(tags, indoorTags, parsedResponse.result, map);

                            //setting the zoom of the map if there are no alarms
                            if (alarmLocations.length === 0 && zoomSetted === 0){
                                alarmLocationsLength = 0;
                                map.setCenter(bounds.getCenter());
                                map.fitBounds(bounds);
                                zoomSetted = 1
                            }else if (alarmLocations.length > 0) {
                                zoomSetted = 0;
                            }

                            homeCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(parsedResponse.result);
                            id4 = ++requestId;
                            socket.send(encodeRequestWithId(id4, 'get_engine_on'));
                        }else if (parsedResponse.id === id4){
                            if (parsedResponse.session_state)
                                window.location.reload();

                            homeCtrl.showEngineOffIcon = parsedResponse.result === 0;
                        }
                    };
                }, 1000);
            };

            $rootScope.$on('constantUpdateNotifications', function(event, map) {
                constantUpdateNotifications(map);
            });

            NgMap.getMap('main-map').then((map) => {
                controllerMap = map;
                dataService.homeMap = map;
                constantUpdateNotifications(map);
                map.set('styles', mapConfiguration);

                dataService.getIndoorLocationTags(markers)
                    .then((response) => {

                        let outdoorLocationTags = dataService.getOutdoorLocationTags(markers, tags);
                        //pining the locations on the map
                        markers.forEach((marker) => {

                            let markerObject = new google.maps.Marker({
                                position : new google.maps.LatLng(marker.position[0], marker.position[1]),
                                animation: google.maps.Animation.DROP,
                                icon     : markersIconPath + ((marker.icon) ? marker.icon : (marker.is_inside) ? 'location-marker.png' : 'mountain.png')
                            });

                            let infoWindow = null;

                            if (marker.is_inside === 1) {
                                let locationTags = response[0].filter(l => l.location === marker.name)[0];
                                let locationAnchors = response[1].filter(l => l.location === marker.name)[0];

                                infoWindow = new google.maps.InfoWindow({
                                    content: '<div class="marker-info-container">' +
                                        '<img src="' + iconsPath + 'login-icon.png" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
                                        '<p class="text-center font-large font-bold color-darkcyan">' + marker.name.toUpperCase() + '</p>' +
                                        '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + marker.position[0] + '</b></p></div>' +
                                        '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + marker.position[1] + '</b></p></div>' +
                                        '<div class="clear-float"><p class="float-left margin-right-10-px">Tags: </p><p class="float-right"><b>' + locationTags.tags + '</b></p></div>' +
                                        '<div class="clear-float"><p class="float-left margin-right-10-px">Anchors: </p><p class="float-right"><b>' + locationAnchors.anchors + '</b></p></div>' +
                                        '</div>'
                                });
                            }else{
                                let locationTags = outdoorLocationTags.filter(l => l.location === marker.name)[0];

                                infoWindow = new google.maps.InfoWindow({
                                    content: '<div class="marker-info-container">' +
                                        '<img src="' + iconsPath + 'login-icon.png" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
                                        '<p class="text-center font-large font-bold color-darkcyan">' + marker.name.toUpperCase() + '</p>' +
                                        '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + marker.position[0] + '</b></p></div>' +
                                        '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + marker.position[1] + '</b></p></div>' +
                                        '<div class="clear-float"><p class="float-left margin-right-10-px">Tags: </p><p class="float-right"><b>' + locationTags.tags + '</b></p></div>' +
                                        '</div>'
                                });
                            }

                            markerObject.addListener('mouseover', function () {
                                infoWindow.open(map, this);
                            });

                            markerObject.addListener('mouseout', function () {
                                infoWindow.close(map, this);
                            });

                            markerObject.addListener('click', () => {
                                let id1 = ++requestId;
                                let id2 = -1;

                                //saving the location data on which I clicked, and then opening the location
                                socket.send(encodeRequestWithId(id1, 'save_location', {location: marker.name}));
                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    if (parsedResponse.id === id1) {
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        if (parsedResponse.result === 'location_saved') {
                                            id2 = ++requestId;
                                            socket.send(encodeRequestWithId(id2, 'get_location_info'));
                                        }
                                    } else if( parsedResponse.id === id2){
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        dataService.location          = parsedResponse.result;
                                        dataService.defaultFloorName  = '';
                                        dataService.locationFromClick = '';
                                        (parsedResponse.result.is_inside)
                                            ? $state.go('canvas')
                                            : $state.go('outdoor-location');
                                    }
                                };
                            });

                            homeCtrl.dynamicMarkers.push(markerObject);
                            bounds.extend(markerObject.getPosition());
                        });

                        homeCtrl.markerClusterer = new MarkerClusterer(map, homeCtrl.dynamicMarkers, {imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});

                        //if there are no markers I set the map to italy with default zoom
                        if (homeCtrl.dynamicMarkers.length === 0) {
                            map.setCenter(new google.maps.LatLng(44.44, 8.88));
                            map.setZoom(mapZoom);
                        }//if there is only a marker I set the map on the marker with zoom 11
                        else if (homeCtrl.dynamicMarkers.length === 1) {
                            map.setCenter(bounds.getCenter());
                            map.setZoom(mapZoom);
                        }//if the map has more than one marker I let maps to set automatically the zoom
                        else {
                            map.setCenter(bounds.getCenter());
                            map.fitBounds(bounds);
                        }
                    });

            });

            //showing the info window with the online/offline tags
            homeCtrl.showOfflineTagsHome = () => {
                if (dataService.homeTimer !== undefined){
                    $interval.cancel(dataService.homeTimer);
                    dataService.homeTimer = undefined;
                    dataService.showOfflineTags('home', constantUpdateNotifications, controllerMap);
                }
            };

            //showing the info window with the online/offline anchors
            homeCtrl.showOfflineAnchorsHome = () => {
                if (dataService.homeTimer !== undefined) {
                    $interval.cancel(dataService.homeTimer);
                    dataService.homeTimer = undefined;
                    dataService.showOfflineAnchors('home', constantUpdateNotifications, controllerMap);
                }
            };

            //showing the info window with all the alarms
            homeCtrl.showAlarmsHome = () => {
                if (dataService.homeTimer !== undefined){
                    $interval.cancel(dataService.homeTimer);
                    dataService.homeTimer = undefined;
                }

                let locationSelected = false;

                $mdDialog.show({
                    templateUrl        : componentsPath + 'indoor-alarms-info.html',
                    parent             : angular.element(document.body),
                    targetEvent        : event,
                    clickOutsideToClose: true,
                    multiple           : true,
                    controller         : ['$scope', 'socketService', 'dataService', ($scope, socketService, dataService) => {
                        $scope.alarms = [];
                        $scope.outlocationTags = dataService.switch.showOutrangeTags;
                        let locations = [];
                        let userLocations = [];
                        let userTags = [];

                        $scope.query  = {
                            limitOptions: [5, 10, 15],
                            order       : 'name',
                            limit       : 5,
                            page        : 1
                        };

                        let id0 = ++requestId;
                        let id = -1, id3 = -1;
                        socket.send(encodeRequestWithId(id0, 'get_tags_by_user', {
                            user: dataService.user.username
                        }));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id0){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                userTags = parsedResponse.result;

                                id3 = ++requestId;
                                socket.send(encodeRequestWithId(id3, 'get_user_locations', {user: dataService.user.id}));
                            } else if (parsedResponse.id === id3){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                userLocations = parsedResponse.result;

                                id = ++requestId;
                                socket.send(encodeRequestWithId(id, 'get_all_locations'));
                            } else if (parsedResponse.id === id){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                locations = parsedResponse.result;

                                let indoorTags = tags.filter(t => !dataService.isOutdoor(t));
                                let outdoorTags = tags.filter(t => dataService.isOutdoor(t));
                                let userIndoorTags = indoorTags.filter(t => userTags.some(ut => t.id === ut.id));
                                userIndoorTags.forEach(tag => {
                                    outdoorTags.push(tag);
                                });

                                // console.log(indoorTags);
                                dataService.getTagsLocation(outdoorTags, parsedResponse.result, userLocations)
                                    .then((response) => {
                                        response.forEach((tagAlarms) => {
                                            if (tagAlarms.length !== 0){
                                                tagAlarms.forEach((alarm) => {
                                                    $scope.alarms.push(alarm);
                                                })
                                            }
                                        });
                                    })
                            }
                        };

                        //opening the location where the alarm is
                        $scope.loadLocation = (alarm) => {
                            let tag = tags.filter(t => t.name === alarm.tag)[0];

                            let id1 = ++requestId;
                            let id2 = -1;

                            if (dataService.isOutdoor(tag)) {
                                locations.forEach((location) => {
                                    if ((dataService.getTagDistanceFromLocationOrigin(tag, [location.latitude, location.longitude])) <= location.radius) {
                                        socket.send(encodeRequestWithId(id1, 'save_location', {location: location.name}));
                                        socket.onmessage = (response) => {
                                            let parsedResponse = parseResponse(response);
                                            if (parsedResponse.id === id1) {
                                                if (parsedResponse.session_state)
                                                    window.location.reload();

                                                if (parsedResponse.result === 'location_saved') {
                                                    locationSelected = true;
                                                    $state.go('outdoor-location');
                                                }
                                            }
                                        }
                                    }
                                });
                            } else {
                                let indoorTag = indoorTags.filter(t => t.name === tag.name)[0];;

                                if (indoorTag === undefined) {
                                    $mdDialog.hide();
                                    $timeout(function () {
                                        $mdDialog.show({
                                            templateUrl        : componentsPath + 'tag-not-found-alert.html',
                                            parent             : angular.element(document.body),
                                            targetEvent        : event,
                                            clickOutsideToClose: true,
                                            controller         : ['$scope', '$controller', 'socketService', 'dataService', ($scope, $controller, socketService, dataService) => {
                                                $controller('languageController', {$scope: $scope});


                                                $scope.title   = lang.tagNotFound.toUpperCase();
                                                $scope.message = lang.tagNotLoggedUser;

                                                $scope.hide = () => {
                                                    $mdDialog.hide();
                                                }
                                            }]
                                        })
                                    }, 10);
                                }else {
                                    id2 = ++requestId;
                                    socket.send(encodeRequestWithId(id2, 'save_location', {location: indoorTag.location_name}));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse.id === id2) {
                                            if (parsedResponse.session_state)
                                                window.location.reload();

                                            if (parsedResponse.result === 'location_saved') {
                                                dataService.defaultFloorName  = indoorTag.floor_name;
                                                dataService.locationFromClick = indoorTag.location_name;
                                                $mdDialog.hide();
                                                locationSelected = true;
                                                $state.go('canvas');
                                            }
                                        }
                                    }
                                }
                            }
                        };

                        //opening the map with the position of the tag out of location
                        $scope.loadTagPosition = (alarm) => {
                            $mdDialog.show({
                                locals             : {tagName: alarm, outerScope: $scope},
                                templateUrl        : componentsPath + 'search-tag-outside.html',
                                parent             : angular.element(document.body),
                                targetEvent        : event,
                                clickOutsideToClose: true,
                                controller         : ['$scope', 'NgMap', 'tagName', 'outerScope', 'socketService', function ($scope, NgMap, tagName, outerScope, socketService) {
                                    $scope.isTagOutOfLocation = 'background-red';
                                    $scope.locationName       = tagName.tag + ' ' + lang.tagOutSite.toUpperCase();
                                    $scope.mapConfiguration   = {
                                        zoom    : 8,
                                        map_type: mapType,
                                    };

                                    let id1 = ++requestId;

                                    let tag = tags.filter(t => t.name === tagName.tag)[0];
                                    socket.send(encodeRequestWithId(id1, 'get_tag_outside_location_zoom'));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse.id === id1){
                                            if (parsedResponse.session_state)
                                                window.location.reload();

                                            $scope.mapConfiguration.zoom = parsedResponse.result;
                                        }
                                    };

                                    NgMap.getMap('search-map').then((map) => {
                                        map.set('styles', mapConfiguration);
                                        let latLng = new google.maps.LatLng(tag.gps_north_degree, tag.gps_east_degree);

                                        map.setCenter(latLng);

                                        new google.maps.Marker({
                                            position: latLng,
                                            map     : map,
                                            icon    : tagsIconPath + 'search-tag.png'
                                        });

                                    });

                                    $scope.hide = () => {
                                        $mdDialog.hide();
                                    }
                                }]
                            })
                        };

                        $scope.hide = () => {
                            $mdDialog.hide();
                        }
                    }],
                    onRemoving: function (event, removePromise) {
                        if (dataService.homeTimer === undefined && !locationSelected) {
                            NgMap.getMap('main-map').then((map) => {
                                constantUpdateNotifications(map)
                            });
                        }
                    }
                })
            };
        }

        //on destroying the pag I release the resources
        $scope.$on('$destroy', function () {
            $mdDialog.hide();
            $interval.cancel(dataService.homeTimer);
            dataService.homeTimer = undefined;
        })
    }

    /**
     * Function that manages the login map
     * @type {string[]}
     */
    outdoorController.$inject = ['$scope', '$rootScope', '$state', '$interval', '$mdDialog', 'NgMap', 'socketService', 'dataService', 'outdoorData'];

    function outdoorController($scope, $rootScope, $state, $interval, $mdDialog, NgMap, socketService, dataService, outdoorData) {
        let outdoorCtrl  = this;
        let tags         = null;
        let bounds       = new google.maps.LatLngBounds();
        let locationInfo = dataService.location;
        let controllerMap = null;
        dataService.drawingManagerRect = new google.maps.drawing.DrawingManager({
            drawingMode          : google.maps.drawing.OverlayType.RECTANGLE,
        });

        dataService.drawingManagerRound = new google.maps.drawing.DrawingManager({
            drawingMode          : google.maps.drawing.OverlayType.CIRCLE,
        });

        let socket = socketService.getSocket();

        dataService.updateMapTimer = null;
        dataService.dynamicTags    = [];

        outdoorCtrl.isAdmin = dataService.isAdmin;

        outdoorCtrl.mapConfiguration = {
            zoom    : 11,
            map_type: mapType,
            center  : mapCenter
        };

        dataService.loadUserSettings();

        //showing the info window with the online/offline tags
        outdoorCtrl.showOfflineTags = () => {
            if (dataService.updateMapTimer !== undefined){
                $interval.cancel(dataService.updateMapTimer);
                dataService.updateMapTimer = undefined;
                dataService.showOfflineTags('outdoor', constantUpdateMapTags, controllerMap);
            }
        };

        //showing the info window with all the alarms
        outdoorCtrl.showAlarms = () => {
            if (dataService.updateMapTimer !== undefined){
                $interval.cancel(dataService.updateMapTimer);
                dataService.updateMapTimer = undefined;
            }

            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'socketService', 'dataService', ($scope, socketService, dataService) => {
                    let locations = [];
                    $scope.alarms = [];
                    $scope.outlocationTags = dataService.switch.showOutrangeTags;

                    $scope.query  = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    let id = ++requestId;
                    socket.send(encodeRequestWithId(id, 'get_all_locations'));
                    socket.onmessage = (response) => {
                        let parsedResponse = parseResponse(response);
                        if (parsedResponse.id === id){
                            if (parsedResponse.session_state)
                                window.location.reload();

                            locations = parsedResponse.result;
                            dataService.getTagsLocation(tags, parsedResponse.result)
                                .then((response) => {
                                    response.forEach((tagAlarms) => {
                                        if (tagAlarms.length !== 0){
                                            tagAlarms.forEach((alarm) => {
                                                $scope.alarms.push(alarm);
                                            })
                                        }
                                    });
                                })
                        }
                    };

                    //opening the location where the alarm is
                    //TODO I can create onbly one function that handle home and outdoor location alarms
                    $scope.loadLocation = (alarm) => {
                        let tag = tags.filter(t => t.name === alarm.tag)[0];

                        let id1 = ++requestId;
                        let id2 = -1;

                        if (dataService.isOutdoor(tag)) {
                            locations.forEach((location) => {
                                if ((dataService.getTagDistanceFromLocationOrigin(tag, [location.latitude, location.longitude])) <= location.radius) {
                                    socket.send(encodeRequestWithId(id1, 'save_location', {location: location.name}));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse.id === id1) {
                                            if (parsedResponse.session_state)
                                                window.location.reload();

                                            if (parsedResponse.result === 'location_saved') {
                                                $mdDialog.hide();
                                                if (dataService.location.name !== location.name)
                                                    window.location.reload();
                                            }
                                        }
                                    }
                                }
                            });
                        } else {
                            let indoorTag = dataService.userTags.filter(t => t.name === tag.name)[0];

                            if (tag === undefined) {
                                $mdDialog.hide();
                                $timeout(function () {
                                    $mdDialog.show({
                                        templateUrl        : componentsPath + 'tag-not-found-alert.html',
                                        parent             : angular.element(document.body),
                                        targetEvent        : event,
                                        clickOutsideToClose: true,
                                        controller         : ['$scope', '$controller', 'socketService', 'dataService', ($scope, $controller, socketService, dataService) => {
                                            $controller('languageController', {$scope: $scope});


                                            $scope.title   = lang.tagNotFound.toUpperCase();
                                            $scope.message = lang.tagNotLoggedUser;

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    })
                                }, 10);
                            }else {
                                id2 = ++requestId;
                                socket.send(encodeRequestWithId(id2, 'save_location', {location: indoorTag.location_name}));
                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    if (parsedResponse.id === id2) {
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        if (parsedResponse.result === 'location_saved') {
                                            dataService.defaultFloorName  = indoorTag.floor_name;
                                            dataService.locationFromClick = indoorTag.location_name;
                                            $mdDialog.hide();
                                            $state.go('canvas');
                                        }
                                    }
                                }
                            }
                        }
                    };

                    //opening the map with the position of the tag out of location
                    //TODO I can create onbly one function that handle home and outdoor location alarms
                    $scope.loadTagPosition = (alarm) => {
                        $mdDialog.show({
                            locals             : {tagName: alarm, outerScope: $scope},
                            templateUrl        : componentsPath + 'search-tag-outside.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            controller         : ['$scope', 'NgMap', 'tagName', 'outerScope', 'socketService', function ($scope, NgMap, tagName, outerScope, socketService) {
                                $scope.isTagOutOfLocation = 'background-red';
                                $scope.locationName       = tagName.tag + ' ' + lang.tagOutSite.toUpperCase();
                                $scope.mapConfiguration   = {
                                    zoom    : 8,
                                    map_type: mapType,
                                };

                                let id1 = ++requestId;

                                let tag = tags.filter(t => t.name === tagName.tag)[0];
                                socket.send(encodeRequestWithId(id1, 'get_tag_outside_location_zoom'));
                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    if (parsedResponse.id === id1){
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        $scope.mapConfiguration.zoom = parsedResponse.result;
                                    }
                                };

                                NgMap.getMap('search-map').then((map) => {
                                    map.set('styles', mapConfiguration);
                                    let latLng = new google.maps.LatLng(tag.gps_north_degree, tag.gps_east_degree);

                                    map.setCenter(latLng);

                                    new google.maps.Marker({
                                        position: latLng,
                                        map     : map,
                                        icon    : tagsIconPath + 'search-tag.png'
                                    });

                                });

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        })
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function (event, removePromise) {
                    if (dataService.updateMapTimer === undefined)
                        constantUpdateMapTags(controllerMap);
                }
            })
        };

        NgMap.getMap('outdoor-map').then((map) => {
            controllerMap = map;
            map.set('styles', mapConfiguration);
            map.setZoom(mapZoom);

            google.maps.event.addListener(map,'click',function(event) {
                console.log(event.latLng.lat());
                console.log(event.latLng.lng());
            });

            constantUpdateMapTags(map, true);

        });

        //function tha maintain a local copy of the tags at n-1 time
        let compareLocalTagsWithRemote = (remoteTags, localTags) => {
            let result = [];

            if (localTags.length === 0)
                angular.copy(remoteTags, localTags);

            localTags = localTags.filter(t => remoteTags.some(rt => rt.name === t.name));

            remoteTags.forEach((remote) => {
                let tag = localTags.find(t => t.name === remote.name);

                if (tag !== undefined) {
                    if (tag.gps_north_degree !== remote.gps_north_degree || tag.gps_east_degree !== remote.gps_east_degree)
                        result.push(tag);
                }
            });

            return result;
        };

        //updating the markers of the map every second
        let constantUpdateMapTags = (map, updateZones) => {
            let tagAlarms       = [];
            let alarmsCounts    = new Array(100).fill(0);
            let prevAlarmCounts = new Array(100).fill(0);
            let localTags       = [];
            let infoWindow = null;

            let id1 = -1;

            let circle = new google.maps.Circle({
                strokeColor  : '#0093c4',
                strokeOpacity: 0.9,
                strokeWeight : 3,
                fillColor    : '#0093c4',
                fillOpacity  : 0.03,
                map          : map,
                center       : new google.maps.LatLng(locationInfo.latitude, locationInfo.longitude),
                radius       : locationInfo.meter_radius,
            });

            circle.addListener('click', function(event){
                infoWindow = new google.maps.InfoWindow({
                    content: '<div class="marker-info-container">' +
                        '<img src="' + iconsPath + 'login-icon.png" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
                        '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + event.latLng.lat() + '</b></p></div>' +
                        '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + event.latLng.lng() + '</b></p></div>' +
                        '</div>'
                });

                infoWindow.open(map);
                infoWindow.setPosition(event.latLng);
            });


            if (updateZones){
                let id = ++requestId;
                socket.send(encodeRequestWithId(id, 'get_outdoor_zones', {location: dataService.location.name}))
                socket.onmessage = (response) => {
                    let parsedResponse = parseResponse(response);
                    if (parsedResponse.id === id){
                        if (parsedResponse.session_state)
                            window.location.reload();

                        parsedResponse.result.forEach(zone => {
                            if (zone.gps_north === null && zone.gps_east === null && zone.radius === null) {
                                dataService.outdoorZones.push({
                                    id: zone.id, zone: new google.maps.Rectangle({
                                        strokeColor  : zone.color,
                                        strokeOpacity: 0.8,
                                        strokeWeight : 2,
                                        fillColor    : zone.color,
                                        fillOpacity  : 0.35,
                                        map          : map,
                                        bounds       : {
                                            north: zone.x_left,
                                            south: zone.x_right,
                                            east : zone.y_up,
                                            west : zone.y_down
                                        }
                                    })
                                });
                            }else{
                                dataService.outdoorZones.push({
                                    id: zone.id, zone: new google.maps.Circle({
                                        strokeColor  : zone.color,
                                        strokeOpacity: 0.8,
                                        strokeWeight : 2,
                                        fillColor    : zone.color,
                                        fillOpacity  : 0.35,
                                        map          : map,
                                        center: {lat: parseFloat(zone.gps_north), lng: parseFloat(zone.gps_east)},
                                        radius: zone.radius * 111000
                                    })
                                });
                            }
                        });
                    }
                };
            }

            dataService.updateMapTimer = $interval(() => {
                console.log('constant update outdoor map');
                id1     = ++requestId;
                let id2 = -1, id3 = -1;
                socket.send(encodeRequestWithId(id1, 'get_all_tags'));
                socket.onmessage = (response) => {
                    let parsedResponse = parseResponse(response);
                    if (parsedResponse.id === id1) {
                        if (parsedResponse.session_state)
                            window.location.reload();

                        tags = parsedResponse.result;
                        outdoorCtrl.showAlarmsIcon      = dataService.checkIfTagsHaveAlarms(parsedResponse.result);
                        outdoorCtrl.showOfflineTagsIcon = dataService.checkIfTagsAreOffline(parsedResponse.result);

                        dataService.playAlarmsAudio(parsedResponse.result);

                        if (compareLocalTagsWithRemote(tags, localTags).length > 0) {
                            localTags.forEach((localTag) => {
                                let marker = new google.maps.Marker({
                                    position: new google.maps.LatLng(localTag.gps_north_degree, localTag.gps_east_degree)
                                });

                                dataService.dynamicTags.forEach((tag, index) => {
                                    if (dataService.dynamicTags[index].getPosition().equals(marker.getPosition())) {
                                        dataService.dynamicTags[index].setMap(null);
                                        dataService.dynamicTags.splice(index, 1);
                                    }
                                });
                            });

                            localTags = [];
                        }

                        tags.forEach((tag, index) => {
                            if (dataService.isOutdoor(tag)) {
                                if ((dataService.getTagDistanceFromLocationOrigin(tag, [locationInfo.latitude, locationInfo.longitude])) <= locationInfo.radius) {
                                    tagAlarms = dataService.getTagAlarms(tag);

                                    let marker = new google.maps.Marker({
                                        position: new google.maps.LatLng(tag.gps_north_degree, tag.gps_east_degree),
                                    });

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
                                                $scope.alarms = [];

                                                $scope.alarms       = dataService.loadTagAlarmsForInfoWindow(tag, null, null);

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
                                    });


                                    if ((new Date(Date.now()) - (new Date(tag.gps_time)) < tag.sleep_time_outdoor) && dataService.switch.showOutdoorTags) {
                                        if (outdoorCtrl.isAdmin ) {
                                            console.log('is Admin')
                                            if (dataService.checkIfTagsHaveAlarmsOutdoor(tags)) {
                                                console.log('tags have allarms');
                                                if (dataService.checkIfTagHasAlarm(tag)) {
                                                    if (markerIsOnMap(dataService.dynamicTags, marker)) {
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
                                                                                $scope.alarms       = dataService.loadTagAlarmsForInfoWindow(tag, null, null);

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
                                                        setIcon(tag, marker);
                                                        dataService.dynamicTags.push(marker);
                                                        marker.setMap(map);
                                                        bounds.extend(marker.getPosition());
                                                    }
                                                } else {
                                                    if (markerIsOnMap(dataService.dynamicTags, marker)) {
                                                        setIcon(tag, marker);
                                                        dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                                            if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                                                dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                                                            }
                                                        });
                                                    } else {
                                                        setIcon(tag, marker);
                                                        dataService.dynamicTags.push(marker);
                                                        marker.setMap(map);
                                                        bounds.extend(marker.getPosition());
                                                    }
                                                }
                                            } else{
                                                dataService.dynamicTags.forEach((tag, index) => {
                                                    if (tag.getPosition().equals(marker.getPosition())) {
                                                        dataService.dynamicTags[index].setMap(null);
                                                        dataService.dynamicTags.splice(index, 1);
                                                    }
                                                });
                                                // dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                                //     dataService.dynamicTags[tagIndex].setMap(null);
                                                // })
                                            }
                                        }else {
                                            if (dataService.checkIfTagHasAlarm(tag)) {
                                                if (markerIsOnMap(dataService.dynamicTags, marker)) {
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
                                                                            $scope.alarms       = dataService.loadTagAlarmsForInfoWindow(tag, null, null);

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
                                                    setIcon(tag, marker);
                                                    dataService.dynamicTags.push(marker);
                                                    marker.setMap(map);
                                                    bounds.extend(marker.getPosition());
                                                }
                                            } else {
                                                if (markerIsOnMap(dataService.dynamicTags, marker)) {
                                                    setIcon(tag, marker);
                                                    dataService.dynamicTags.forEach((insideTag, tagIndex) => {
                                                        if (dataService.dynamicTags[tagIndex].getPosition().equals(marker.getPosition())) {
                                                            dataService.dynamicTags[tagIndex].setIcon(marker.getIcon());
                                                        }
                                                    });
                                                } else {
                                                    setIcon(tag, marker);
                                                    dataService.dynamicTags.push(marker);
                                                    marker.setMap(map);
                                                    bounds.extend(marker.getPosition());
                                                }
                                            }
                                        }
                                    } else if (dataService.checkIfTagHasAlarm(tag)) {
                                        if (markerIsOnMap(dataService.dynamicTags, marker)) {
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
                                                                    $scope.alarms       = dataService.loadTagAlarmsForInfoWindow(tag, null, null);

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
                                            setIcon(tag, marker);
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

                                    prevAlarmCounts[index] = tagAlarms.length;
                                }
                            }
                        });

                        if (dataService.dynamicTags.length === 1) {
                            map.setCenter(bounds.getCenter());
                        } else if (dataService.dynamicTags.length > 1) {
                            map.setCenter(bounds.getCenter());
                        } else {
                            let latLng = new google.maps.LatLng(dataService.location.latitude, dataService.location.longitude);
                            map.setCenter(latLng);
                        }

                        id2 = ++requestId;
                        socket.send(encodeRequestWithId(id2, 'get_anchors_by_user', {user: dataService.user.username}));
                    } else if(parsedResponse.id === id2){
                        if (parsedResponse.session_state)
                            window.location.reload();

                        outdoorCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(parsedResponse.result);
                        id3 = ++requestId;
                        socket.send(encodeRequestWithId(id3, 'get_engine_on'));
                    } else if (parsedResponse.id === id3){
                        if (parsedResponse.session_state)
                            window.location.reload();

                        outdoorCtrl.showEngineOffIcon = parsedResponse.result === 0;
                    }
                }
            }, 1000)
        };

        $rootScope.$on('constantUpdateMapTags', function(event, map) {
            constantUpdateMapTags(map);
        });

        //function that sets an icon image to the marker passed as parameter
        let setIcon = (tag, marker) => {
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
        let markerIsOnMap = (markers, marker) => {
            return markers.some(m => m.getPosition().equals(marker.getPosition()));
        };

        //funzione che riporta alla home del sito
        outdoorCtrl.goHome = () => {
            dataService.goHome();
        };

        //releasing the resources on page destroy
        $scope.$on('$destroy', () => {
            $mdDialog.hide();
            $interval.cancel(dataService.updateMapTimer);
            bounds = new google.maps.LatLngBounds(null);
        })
    }

    /**
     * Function that handles the canvas interaction
     * @type {string[]}
     */
    canvasController.$inject = ['$rootScope', '$scope', '$state', '$mdDialog', '$timeout', '$interval', '$mdSidenav', 'socketService', 'canvasData', 'dataService'];

    function canvasController($rootScope, $scope, $state, $mdDialog, $timeout, $interval, $mdSidenav, socketService, canvasData, dataService) {
        let canvasCtrl         = this;
        let canvas             = document.querySelector('#canvas-id');
        let context            = canvas.getContext('2d');
        let bufferCanvas       = document.createElement('canvas');
        let bufferContext      = bufferCanvas.getContext('2d');
        let canvasImage        = new Image();
        let dragingImage       = new Image();
        let mouseDownCoords    = null;
        let prevClick          = null;
        let drawAnchor         = null;
        let drawAnchorImage    = null;
        let dropAnchorPosition = null;
        let dragingStarted     = 0;
        let drawedLines        = [];
        let drawedZones        = [];
        let zones = null;
        let newBegin           = [];
        let newEnd             = [];
        let anchorToDrop       = '';
        let zoneToModify = null;
        let alpha = canvasData.alpha;
        let socket = socketService.getSocket();

        canvasCtrl.floors                 = dataService.floors;
        canvasCtrl.showAlarmsIcon         = false;
        canvasCtrl.showOfflineTagsIcon    = false;
        canvasCtrl.showOfflineAnchorsIcon = false;
        canvasCtrl.drawingImage           = 'horizontal-line.png';

        if (dataService.defaultFloorName === '') {
            canvasCtrl.defaultFloor      = [dataService.floors[0]];
            dataService.defaultFloorName = dataService.floors[0].name;
        } else {
            canvasCtrl.defaultFloor = dataService.userFloors.filter(f => f.name === dataService.defaultFloorName);
        }

        //floor initial data
        canvasCtrl.floorData = {
            defaultFloorName: canvasCtrl.defaultFloor[0].name,
            gridSpacing     : canvasCtrl.defaultFloor[0].map_spacing,
            location        : (dataService.locationFromClick === '') ? dataService.location.name : dataService.locationFromClick,
            floor_image_map : canvasCtrl.defaultFloor[0].image_map,
            floorZones: []
        };

        //drawing button
        canvasCtrl.speedDial = {
            isOpen           : false,
            selectedDirection: 'left',
            mode             : 'md-scale',
            clickedButton    : 'horizontal'
        };

        canvasCtrl.switch = {
            showDrawing   : false,
            showFullscreen: false,
        };

        canvasImage.src = floorPath + canvasCtrl.floorData.floor_image_map;

        dataService.loadUserSettings();

        //watching for changes in switch buttons in menu
        $scope.$watchGroup(['dataService.switch.showGrid', 'dataService.switch.showAnchors', 'dataService.switch.showCameras', 'canvasCtrl.switch.showFullscreen', 'canvasCtrl.floorData.gridSpacing', 'canvasCtrl.switch.showDrawing'], function (newValues) {
            //setting the floor spacing in the slider
            if (canvasCtrl.defaultFloor[0].map_spacing !== newValues[4])
                canvasCtrl.defaultFloor[0].map_spacing = newValues[4];

            //showing the fullscreen
            if (newValues[3]) {
                openFullScreen(document.querySelector('body'));
                $mdSidenav('left').close();
            }else if(document.fullscreenElement|| document.webkitFullscreenElement || document.mozFullScreenElement ||
                document.msFullscreenElement){
                document.exitFullscreen();
                canvasCtrl.switch.showFullscreen = false;
            }

            //showing drawing mode
            if (newValues[5] === true) {
                dataService.switch.showAnchors     = false;
                dataService.switch.showCameras     = false;
                canvasCtrl.showAlarmsIcon          = false;
                canvasCtrl.showOfflineTagsIcon     = false;
                canvasCtrl.showOfflineAnchorsIcon  = false;
                canvasCtrl.showEngineOffIcon  = false;
                canvasCtrl.speedDial.clickedButton = 'horizontal';
                drawedZones = [];

                $mdSidenav('left').close();

                $interval.cancel(dataService.canvasInterval);
                dataService.canvasInterval = undefined;

                let id = ++requestId;
                let id1 = -1;
                socket.send(encodeRequestWithId(id, 'get_floor_zones', {
                        floor   : canvasCtrl.floorData.defaultFloorName,
                        location: canvasCtrl.floorData.location,
                        user    : dataService.user.username
                    }));

                socket.onmessage = (response) => {
                    let parsedResponse = parseResponse(response);
                    if (parsedResponse.id === id){
                        if (parsedResponse.session_state)
                            window.location.reload();

                        zones = parsedResponse.result;
                        id1 = ++requestId;
                        socket.send(encodeRequestWithId(id1, 'get_drawing', {floor: canvasCtrl.defaultFloor[0].id}));
                    } else if (parsedResponse.id === id1){
                        if (parsedResponse.session_state)
                            window.location.reload();

                        let parsedResponseDrawing = JSON.parse(parsedResponse.result);
                        drawedLines        = (parsedResponseDrawing === null) ? [] : parsedResponseDrawing;

                        if (drawedLines !== null)
                            updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, (canvasCtrl.speedDial.clickedButton === 'drop_anchor'));

                        if (zones !== null)
                            zones.forEach((zone) => {
                                drawZoneRect({x: zone.x_left, y: zone.y_up, xx: zone.x_right, yy: zone.y_down}, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.color, true, alpha);
                            })
                    }
                };
            } else if (newValues[5] === false) {
                if (dataService.canvasInterval === undefined) {
                    constantUpdateCanvas();
                }
            }
        });

        //watching the floor selection button
        $scope.$watch('canvasCtrl.floorData.defaultFloorName', (newValue) => {
            if (newValue !== undefined)
                canvasCtrl.defaultFloor = [dataService.userFloors.filter(f => {
                    return f.name === newValue
                })[0]];

            canvasCtrl.floorData.defaultFloorName = canvasCtrl.defaultFloor[0].name;
            dataService.defaultFloorName          = canvasCtrl.defaultFloor[0].name;
            canvasCtrl.floorData.gridSpacing      = canvasCtrl.defaultFloor[0].map_spacing;
            canvasCtrl.floorData.floor_image_map  = canvasCtrl.defaultFloor[0].image_map;
            canvasImage.src = floorPath + canvasCtrl.floorData.floor_image_map;
            context.clearRect(0, 0, canvas.width, canvas.height);
            if (dataService.canvasInterval === undefined) {
                constantUpdateCanvas();
            }
        });

        //function that handles the click on the drawing mode
        canvasCtrl.speedDialClicked = (button) => {
            if (button === 'drop_anchor') {
                updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, false);

                if (dataService.anchors.length > 0) {
                    loadAndDrawImagesOnCanvas(dataService.anchors, 'anchor', canvas, context, true);
                }
            } else if (button === 'vertical') {
                canvasCtrl.drawingImage = 'vertical-line.png';
            } else if (button === 'horizontal') {
                canvasCtrl.drawingImage = 'horizontal-line.png';
            } else if (button === 'inclined') {
                canvasCtrl.drawingImage = 'inclined-line.png';
            } else if (button === 'delete') {
                canvasCtrl.drawingImage = 'erase_24.png';
            } else if (button === 'draw_zone'){
                canvasCtrl.drawingImage = 'draw_zone.png'
            } else if (button === 'delete_zone'){
                canvasCtrl.drawingImage = 'delete_zone.png'
            }else if (button === 'modify_zone'){
                canvasCtrl.drawingImage = 'modify_zone.png'
            }

            canvasCtrl.speedDial.clickedButton = button;
        };

        //function that loads the floor map and starts the constant update of the floor
        canvasCtrl.loadFloor = () => {

            canvasImage.onload = function () {
                canvas.width  = this.naturalWidth;
                canvas.height = this.naturalHeight;

                //updating the canvas and drawing border
                updateCanvas(canvas.width, canvas.height, context, canvasImage);
            };

            //constantly updating the canvas
            if (dataService.canvasInterval === undefined)
                constantUpdateCanvas();

        };

        //function that loads all the images passed as parameter
        let loadAlarmsImagesWithPromise = (images) => {
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

        //constantly updating the canvas with the objects position from the server
        let constantUpdateCanvas = () => {
            let alarmsCounts   = new Array(100).fill(0);

            dataService.canvasInterval = $interval(function () {
                bufferCanvas.width  = canvasImage.naturalWidth;
                bufferCanvas.height = canvasImage.naturalHeight;

                console.log('constant update canvas');
                //updating the canvas and drawing border
                updateCanvas(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasImage);

                if (dataService.switch.showGrid) {
                    //drawing vertical
                    drawDashedLine(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, 'vertical');
                    //drawing horizontal lines
                    drawDashedLine(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, 'horizontal');
                }

                let id = ++requestId;
                let id1, id2, id3, id4, id5, id6 = -1, id7 = -1;

                socket.send(encodeRequestWithId(id, 'get_floors_by_location', {location: canvasCtrl.floorData.location}));
                socket.onmessage = (response) => {
                    let parsedResponse = parseResponse(response);
                    if (parsedResponse.id === id) {
                        if (parsedResponse.session_state)
                            window.location.reload();

                        if (!angular.equals(canvasCtrl.floors, parsedResponse.result)) {
                            let newFloor = null;
                            if (parsedResponse.result.length > canvasCtrl.floors.length) {
                                newFloor = parsedResponse.result.filter(f => !canvasCtrl.floors.some(cf => f.id === cf.id))[0];
                                dataService.userFloors.push(newFloor);
                            } else {
                                newFloor = canvasCtrl.floors.filter(f => !parsedResponse.result.some(pf => f.id === pf.id))[0];
                                if (newFloor !== undefined)
                                    dataService.userFloors = dataService.userFloors.filter(f => f.id !== newFloor.id);
                            }
                            canvasCtrl.floors = parsedResponse.result;
                        }
                        id1 = ++requestId;
                        socket.send(encodeRequestWithId(id1, 'get_drawing', {floor: canvasCtrl.defaultFloor[0].id}));
                    } else if (parsedResponse.id === id1) {
                        if (parsedResponse.session_state)
                            window.location.reload();

                        let parsedDraw = JSON.parse(parsedResponse.result);
                        if (parsedDraw !== null) {
                            parsedDraw.forEach((line) => {
                                drawLine(line.begin, line.end, line.type, bufferContext, canvasCtrl.switch.showDrawing);
                            });
                        }
                        id7 = ++requestId;
                        socket.send(encodeRequestWithId(id7, 'get_floor_zones', {
                            floor   : canvasCtrl.floorData.defaultFloorName,
                            location: canvasCtrl.floorData.location,
                            user    : dataService.user.username
                        }));
                    } else if (parsedResponse.id === id7) {
                        if (parsedResponse.session_state)
                            window.location.reload();

                        if (parsedResponse.result.length > 0 && dataService.switch.showZones) {
                            canvasCtrl.floorData.floorZones = parsedResponse.result;
                            parsedResponse.result.forEach((zone) => {
                                drawZoneRect({
                                    x : zone.x_left,
                                    y : zone.y_up,
                                    xx: zone.x_right,
                                    yy: zone.y_down
                                }, bufferContext, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, zone.color, false, alpha);
                            });
                        }
                        id2 = ++requestId;
                        socket.send(encodeRequestWithId(id2, 'get_anchors_by_floor_and_location', {
                            floor   : canvasCtrl.floorData.defaultFloorName,
                            location: canvasCtrl.floorData.location
                        }));
                    } else if (parsedResponse.id === id2) {
                        if (parsedResponse.session_state)
                            window.location.reload();

                        dataService.anchors = parsedResponse.result;
                        console.log(dataService.anchors);
                        if (parsedResponse.result.length > 0) {
                            loadAndDrawImagesOnCanvas(parsedResponse.result, 'anchor', bufferCanvas, bufferContext, dataService.switch.showAnchors);
                            canvasCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(parsedResponse.result);
                        }
                        id3 = ++requestId;
                        socket.send(encodeRequestWithId(id3, 'get_cameras_by_floor_and_location', {
                            floor   : canvasCtrl.floorData.defaultFloorName,
                            location: canvasCtrl.floorData.location
                        }));
                    } else if (parsedResponse.id === id3) {
                        if (parsedResponse.session_state)
                            window.location.reload();

                        if (parsedResponse.result.length > 0)
                            loadAndDrawImagesOnCanvas(parsedResponse.result, 'camera', bufferCanvas, bufferContext, dataService.switch.showCameras);

                        dataService.cameras = parsedResponse.result;

                        id4 = ++requestId;
                        socket.send(encodeRequestWithId(id4, 'get_tags_by_floor_and_location', {
                            floor   : canvasCtrl.defaultFloor[0].id,
                            location: canvasCtrl.floorData.location
                        }));
                    } else if (parsedResponse.id === id4) {
                        if (parsedResponse.session_state)
                            window.location.reload();

                        dataService.playAlarmsAudio(parsedResponse.result);
                        dataService.floorTags = parsedResponse.result;

                        let tagClouds            = [];
                        let isolatedTags         = [];
                        let singleAndGroupedTags = [];
                        let step                 = 0;

                        let temporaryTagsArray = {
                            singleTags: angular.copy(parsedResponse.result),
                        };

                        for (let i = 0; i < parsedResponse.result.length; i = step) {
                            //getting the near tags of the tag passed as second parameter
                            temporaryTagsArray = groupNearTags(temporaryTagsArray.singleTags, parsedResponse.result[i]);

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

                        dataService.loadImagesAsynchronouslyWithPromise(tagClouds, 'tag')
                            .then((images) => {
                                //control if there are clouds to bhe shown
                                if (images !== null) {
                                    //drawing the clouds on the canvas
                                    images.forEach(function (image, index) {
                                        drawCloudIcon(tagClouds[index][0], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[0].length);
                                    });
                                }

                                return dataService.loadImagesAsynchronouslyWithPromise(isolatedTags, 'tag');
                            })
                            .then((images) => {
                                if (images !== null) {
                                    //drawing the isolated tags
                                    isolatedTags.forEach(function (tag, index) {
                                        if (!dataService.isOutdoor(tag[0])) {
                                            if (tag[0].tag_type_id === 1 || tag[0].tag_type_id === 14) {
                                                if (dataService.checkIfTagHasAlarm(tag[0])) {
                                                    loadAlarmsImagesWithPromise(dataService.getTagAlarms(tag[0]))
                                                        .then((alarmImages) => {
                                                            if (alarmsCounts[index] > alarmImages.length - 1)
                                                                alarmsCounts[index] = 0;
                                                            drawIcon(tag[0], bufferContext, alarmImages[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                            context.drawImage(bufferCanvas, 0, 0);
                                                        });
                                                } else if (!dataService.isTagOffline(tag)) {
                                                    drawIcon(tag[0], bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                }
                                            } else {
                                                if (dataService.checkIfTagHasAlarm(tag[0])) {
                                                    loadAlarmsImagesWithPromise(dataService.getTagAlarms(tag[0]))
                                                        .then((alarmImages) => {
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
                                context.drawImage(bufferCanvas, 0, 0);
                            });

                        id5 = ++requestId;
                        socket.send(encodeRequestWithId(id5, 'get_all_tags', {user: dataService.user.username}));
                    }else if (parsedResponse.id === id5){
                        if (parsedResponse.session_state)
                            window.location.reload();

                        dataService.allTags = parsedResponse.result;
                        canvasCtrl.showAlarmsIcon      = dataService.checkTagsStateAlarmNoAlarmOffline(parsedResponse.result).withAlarm;
                        //showing the offline anchors and alarm button
                        canvasCtrl.showOfflineTagsIcon = dataService.checkIfTagsAreOffline(parsedResponse.result);
                        id6 = ++requestId;
                        socket.send(encodeRequestWithId(id6, 'get_engine_on'));
                    } else if (parsedResponse.id === id6){
                        if (parsedResponse.session_state)
                            window.location.reload();

                        canvasCtrl.showEngineOffIcon = parsedResponse.result === 0;
                    }
                };
            }, 1000);
        };

        $rootScope.$on('constantUpdateCanvas', function() {
            constantUpdateCanvas();
        });

        canvasCtrl.loadFloor();

        //loading images and drawing them on canvas
        let loadAndDrawImagesOnCanvas = (objects, objectType, canvas, context, hasToBeDrawn) => {
            if (hasToBeDrawn) {
                dataService.loadImagesAsynchronouslyWithPromise(objects, objectType).then(
                    function (allImages) {
                        allImages.forEach(function (image, index) {
                            drawIcon(objects[index], context, image, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, false);
                        })
                    }
                )
            }
        };

        //grouping the tags in one object divided by clouds of tags and single tags
        let groupNearTags = (tags, tag) => {
            let tagsGrouping = {
                groupTags : [],
                singleTags: []
            };

            tags.forEach(function (tagElement) {
                if ((tagElement.x_pos - 0.5 < tag.x_pos && tag.x_pos < tagElement.x_pos + 0.5
                    && (tagElement.y_pos - 0.5 < tag.y_pos && tag.y_pos < tagElement.y_pos + 0.5)) && !(tagElement.is_exit && tagElement.radio_switched_off)) {
                    if (tagElement.tag_type_id !== 1 && tagElement.tag_type_id !== 14) {
                        if (dataService.checkIfTagHasAlarm(tagElement) || ((new Date(Date.now()) - (new Date(tagElement.time))) < tagElement.sleep_time_indoor)) {
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

        //getting the coordinate of the click within respect the canvas
        HTMLCanvasElement.prototype.canvasMouseClickCoords = function (event) {
            let totalOffsetX   = 0;
            let totalOffsetY   = 0;
            let canvasX, canvasY;
            let currentElement = this;

            do {
                totalOffsetX += currentElement.offsetLeft;
                totalOffsetY += currentElement.offsetTop;
            } while (currentElement === currentElement.offsetParent);

            canvasX = event.pageX - totalOffsetX;
            canvasY = event.pageY - totalOffsetY;

            // Fix for variable canvas width
            canvasX = Math.round(canvasX * (this.width / this.offsetWidth));
            canvasY = Math.round(canvasY * (this.height / this.offsetHeight));

            return {x: canvasX, y: canvasY}
        };

        //function that save the canvas drawing
        canvasCtrl.saveDrawing = () => {
            let id = ++requestId;
            let id1 = -1, id2 = -1;

            let tempDrawZones = [];
            drawedZones.forEach((zone) => {
                let topLeft = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.topLeft.x, zone.topLeft.y);
                let bottomRight = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.bottomRight.x, zone.bottomRight.y);
                let zonesModified = canvasCtrl.floorData.floorZones.some(z => zone.id === z.id);

                if (!zonesModified)
                    tempDrawZones.push({topLeft: topLeft, bottomRight: bottomRight, floor: zone.floor});
            });

            id1 = ++requestId;
            socket.send(encodeRequestWithId(id, 'save_drawing', {
                lines: JSON.stringify(drawedLines),
                floor: canvasCtrl.defaultFloor[0].id,
                zones: tempDrawZones
            }));

            socket.onmessage = (response) => {
                let parsedResponse = parseResponse(response);
                if (parsedResponse.id === id) {
                    if (parsedResponse.session_state)
                        window.location.reload();

                    let scaledAnchorPosition = [];
                    let drawAnchor           = [];

                    //TODO update anchors only if there is at least one anchor modified
                    dataService.anchorsToUpdate.forEach((anchor) => {
                        let scaledSize = {width: anchor.x_pos, height: anchor.y_pos};
                        scaledAnchorPosition.push(scaledSize);
                        drawAnchor.push(anchor.id);
                    });

                    id1 = ++requestId;
                    socket.send(encodeRequestWithId(id1, 'update_anchor_position', {
                        position: scaledAnchorPosition,
                        id      : drawAnchor,
                        floor   : canvasCtrl.floorData.defaultFloorName
                    }));

                    dataService.switch.showAnchors = true;
                    dataService.switch.showCameras = true;
                    canvasCtrl.switch.showDrawing  = false;

                    dropAnchorPosition                 = null;
                    drawAnchorImage                    = null;
                    canvasCtrl.speedDial.clickedButton = '';

                    dataService.anchorsToUpdate = [];
                    if (dataService.canvasInterval === undefined) constantUpdateCanvas();
                } else if (parsedResponse.id === id1) {
                    if (parsedResponse.session_state)
                        window.location.reload();
                }
            }
        };

        canvasCtrl.cancelDrawing = () => {
            dataService.switch.showAnchors = true;
            dataService.switch.showCameras = true;
            canvasCtrl.switch.showDrawing = false;

            dropAnchorPosition                 = null;
            drawAnchorImage                    = null;
            canvasCtrl.speedDial.clickedButton = '';
            if (dataService.canvasInterval === undefined) constantUpdateCanvas();
        };

        //handeling the canvas click
        canvas.addEventListener('mousemove', (event) => {
            if (dataService.switch !== undefined && canvasCtrl.switch.showDrawing) {

                if (drawedLines !== null && canvasCtrl.speedDial.clickedButton !== 'drop_anchor') {
                    updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, false);

                    if (dragingStarted === 1 && canvasCtrl.speedDial.clickedButton !== 'draw_zone') {
                        if (drawedLines.some(l => ((l.begin.x - 5 <= prevClick.x && prevClick.x <= l.begin.x + 5) && (l.begin.y - 5 <= prevClick.y && prevClick.y <= l.begin.y + 5)))) {
                            newBegin = drawedLines.filter(l => (l.begin.x - 5 <= prevClick.x && prevClick.x <= l.begin.x + 5) && (l.begin.y - 5 <= prevClick.y && prevClick.y <= l.begin.y + 5))[0];
                            drawLine(newBegin.begin, canvas.canvasMouseClickCoords(event), canvasCtrl.speedDial.clickedButton, context);
                        } else if (drawedLines.some(l => ((l.end.x - 5 <= prevClick.x && prevClick.x <= l.end.x + 5) && (l.end.y - 5 <= prevClick.y && prevClick.y <= l.end.y + 5)))) {
                            newEnd = drawedLines.filter(l => (l.end.x - 5 <= prevClick.x && prevClick.x <= l.end.x + 5) && (l.end.y - 5 <= prevClick.y && prevClick.y <= l.end.y + 5))[0];
                            drawLine(newEnd.end, canvas.canvasMouseClickCoords(event), canvasCtrl.speedDial.clickedButton, context);
                        } else {
                            drawLine(prevClick, canvas.canvasMouseClickCoords(event), canvasCtrl.speedDial.clickedButton, context);
                        }
                    }

                }

                if (dragingStarted === 1 && canvasCtrl.speedDial.clickedButton === 'draw_zone') {
                    drawZoneRectFromDrawing({x: prevClick.x, y: prevClick.y, xx: canvas.canvasMouseClickCoords(event).x, yy: canvas.canvasMouseClickCoords(event).y}, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, 'red', alpha);
                }

                if (zones !== null && canvasCtrl.speedDial.clickedButton !== 'drop_anchor'){
                    zones.forEach((zone) => {
                        drawZoneRect({x: zone.x_left, y: zone.y_up, xx: zone.x_right, yy: zone.y_down}, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.color, true, alpha);
                    })
                }

                if (drawedZones !== null && canvasCtrl.speedDial.clickedButton !== 'drop_anchor'){
                    drawedZones.forEach((zone) => {
                        drawZoneRectFromDrawing({x: zone.topLeft.x, y: zone.topLeft.y, xx: zone.bottomRight.x, yy: zone.bottomRight.y}, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, 'red', alpha);
                    })
                }

                if (zoneToModify !== null){
                    drawedZones = drawedZones.filter(z => !angular.equals(zoneToModify, z));
                    zones = zones.filter(z => z.id !== zoneToModify.id);
                    drawZoneRectFromDrawing({x: zoneToModify.bottomRight.x, y: zoneToModify.bottomRight.y, xx: canvas.canvasMouseClickCoords(event).x, yy: canvas.canvasMouseClickCoords(event).y}, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, 'red', alpha);
                }

                // if (drawAnchorImage !== null) {
                //     context.drawImage(drawAnchorImage, dropAnchorPosition.width, dropAnchorPosition.height);
                // }
            }
        });

        //handeling the mouse move on the canvas
        canvas.addEventListener('mousedown', function (event) {
            let tagCloud    = null;
            let dialogShown = false;
            let realHeight  = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;
            mouseDownCoords = canvas.canvasMouseClickCoords(event);

            //drawing on canvas
            if (canvasCtrl.switch.showDrawing && canvasCtrl.speedDial.clickedButton !== 'delete' && canvasCtrl.speedDial.clickedButton !== 'drop_anchor'
                && canvasCtrl.speedDial.clickedButton !== 'draw_zone' && canvasCtrl.speedDial.clickedButton !== 'delete_zone' && canvasCtrl.speedDial.clickedButton !== 'modify_zone') {
                dragingStarted++;

                if (dragingStarted === 1) {
                    prevClick = canvas.canvasMouseClickCoords(event);
                    if (drawedLines.some(l => ((l.begin.x - 5 <= prevClick.x && prevClick.x <= l.begin.x + 5) && (l.begin.y - 5 <= prevClick.y && prevClick.y <= l.begin.y + 5)))) {
                        prevClick = drawedLines.filter(l => (l.begin.x - 5 <= prevClick.x && prevClick.x <= l.begin.x + 5) && (l.begin.y - 5 <= prevClick.y && prevClick.y <= l.begin.y + 5))[0].begin;
                    } else if (drawedLines.some(l => ((l.end.x - 5 <= prevClick.x && prevClick.x <= l.end.x + 5) && (l.end.y - 5 <= prevClick.y && prevClick.y <= l.end.y + 5)))) {
                        prevClick = drawedLines.filter(l => (l.end.x - 5 <= prevClick.x && prevClick.x <= l.end.x + 5) && (l.end.y - 5 <= prevClick.y && prevClick.y <= l.end.y + 5))[0].end;
                    }
                } else if (dragingStarted === 2) {
                    if (canvasCtrl.speedDial.clickedButton !== 'delete') {
                        if (canvasCtrl.speedDial.clickedButton === 'vertical') {
                            drawedLines.push({
                                begin: prevClick,
                                end  : {x: prevClick.x, y: mouseDownCoords.y},
                                type : canvasCtrl.speedDial.clickedButton
                            });
                        } else if (canvasCtrl.speedDial.clickedButton === 'horizontal') {
                            drawedLines.push({
                                begin: prevClick,
                                end  : {x: mouseDownCoords.x, y: prevClick.y},
                                type : canvasCtrl.speedDial.clickedButton
                            });
                        } else if (canvasCtrl.speedDial.clickedButton === 'inclined') {
                            drawedLines.push({
                                begin: prevClick,
                                end  : mouseDownCoords,
                                type : canvasCtrl.speedDial.clickedButton
                            });
                        }
                    }
                    dragingStarted = 0;
                }
            }

            //changing anchor position
            if (canvasCtrl.speedDial.clickedButton === 'drop_anchor') {
                $mdDialog.show({
                    templateUrl        : componentsPath + 'select_drop_anchor.html',
                    parent             : angular.element(document.body),
                    targetEvent        : event,
                    clickOutsideToClose: true,
                    controller         : ['$scope', 'socketService', 'dataService', ($scope, socketService, dataService) => {
                        $scope.dropAnchor = {
                            selectedAnchor: ''
                        };

                        console.log('empy anchors to update');

                        let id = ++requestId;
                        socket.send(encodeRequestWithId(id, 'get_anchors_by_location', {
                            location: dataService.location.name
                        }));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                $scope.anchors = parsedResponse.result;
                                dataService.locationAnchors = parsedResponse.result;
                                $scope.$apply();
                            }
                        };

                        $scope.$watch('dropAnchor.selectedAnchor', (newValue) => {
                            let currentValue = "" + newValue;
                            if (currentValue !== '') {
                                anchorToDrop = currentValue;
                                $mdDialog.hide();
                                console.log(dataService.anchorsToUpdate);
                                for (let index in dataService.locationAnchors){
                                    if (dataService.locationAnchors[index].name === newValue){
                                        console.log(dataService.locationAnchors[index]);
                                        let scaledSize = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, mouseDownCoords.x, mouseDownCoords.y );
                                        dataService.locationAnchors[index].x_pos = parseFloat(scaledSize.x);
                                        dataService.locationAnchors[index].y_pos = parseFloat(scaledSize.y);
                                        dataService.locationAnchors[index].floor_id = canvasCtrl.defaultFloor[0].id;
                                        dataService.anchorsToUpdate.push(dataService.locationAnchors[index]);
                                        if (dataService.anchors.some(a => a.id === dataService.locationAnchors[index].id)){
                                            for(let anchorIndex in dataService.anchors){
                                                if (dataService.anchors[anchorIndex].id === dataService.locationAnchors[index].id){
                                                    dataService.anchors[anchorIndex].x_pos = parseFloat(scaledSize.x);
                                                    dataService.anchors[anchorIndex].y_pos = parseFloat(scaledSize.y);
                                                    dataService.anchors[anchorIndex].floor_id = dataService.locationAnchors[index].floor_id;
                                                }
                                            }
                                        } else {
                                            dataService.anchors.push(dataService.locationAnchors[index]);
                                        }
                                    }
                                }
                                updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, (canvasCtrl.speedDial.clickedButton === 'drop_anchor'));
                            }
                        });

                        $scope.hide = () => {
                            $mdDialog.hide();
                        }
                    }]
                });

            }

            //deleting drawings
            if (canvasCtrl.speedDial.clickedButton === 'delete') {
                let toBeRemoved = drawedLines.filter(l => ((l.begin.x - 5 <= mouseDownCoords.x && mouseDownCoords.x <= l.begin.x + 5) && (l.begin.y - 5 <= mouseDownCoords.y && mouseDownCoords.y <= l.begin.y + 5))
                    || ((l.end.x - 5 <= mouseDownCoords.x && mouseDownCoords.x <= l.end.x + 5) && (l.end.y - 5 <= mouseDownCoords.y && mouseDownCoords.y <= l.end.y + 5)));


                if (toBeRemoved.length > 0) {
                    drawedLines = drawedLines.filter(l => !toBeRemoved.some(r => r.begin.x === l.begin.x && r.begin.y === l.begin.y
                        && r.end.x === l.end.x && r.end.y === l.end.y));

                    updateDrawingCanvas([], drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, (canvasCtrl.speedDial.clickedButton === 'drop_anchor'));

                    if (zones !== null && canvasCtrl.speedDial.clickedButton !== 'drop_anchor'){
                        zones.forEach((zone) => {
                            drawZoneRect({x: zone.x_left, y: zone.y_up, xx: zone.x_right, yy: zone.y_down}, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.color, true, alpha);
                        })
                    }

                    if (drawedZones !== null && canvasCtrl.speedDial.clickedButton !== 'drop_anchor'){
                        drawedZones.forEach((zone) => {
                            drawZoneRectFromDrawing({x: zone.topLeft.x, y: zone.topLeft.y, xx: zone.bottomRight.x, yy: zone.bottomRight.y}, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.color, alpha);
                        })
                    }
                }
            }

            if (canvasCtrl.speedDial.clickedButton === 'draw_zone'){
                dragingStarted++;
                if (dragingStarted === 1) {
                    prevClick = canvas.canvasMouseClickCoords(event);
                }else if (dragingStarted === 2){
                    let topLeft = null;
                    let bottomRight = null;
                    //up left
                    if (prevClick.x < mouseDownCoords.x && prevClick.y < mouseDownCoords.y) {
                        drawedZones.push({
                            topLeft    : prevClick,
                            bottomRight: mouseDownCoords,
                            floor      : canvasCtrl.defaultFloor[0].id
                        });
                    }//up right
                    else if( prevClick.x > mouseDownCoords.x && prevClick.y < mouseDownCoords.y){
                        topLeft = {x: mouseDownCoords.x, y: prevClick.y};
                        bottomRight = {x: prevClick.x, y: mouseDownCoords.y};
                        drawedZones.push({
                            topLeft    : topLeft,
                            bottomRight: bottomRight,
                            floor      : canvasCtrl.defaultFloor[0].id
                        });
                    }//down left
                    else if( prevClick.x < mouseDownCoords.x &&  prevClick.y > mouseDownCoords.y){
                        topLeft = {x: prevClick.x, y: mouseDownCoords.y};
                        bottomRight = {x: mouseDownCoords.x, y: prevClick.y};
                        drawedZones.push({
                            topLeft    : topLeft,
                            bottomRight: bottomRight,
                            floor      : canvasCtrl.defaultFloor[0].id
                        });
                    }//down right
                    else if( prevClick.x > mouseDownCoords.x &&  prevClick.y > mouseDownCoords.y){
                        drawedZones.push({
                            topLeft    : mouseDownCoords,
                            bottomRight: prevClick,
                            floor      : canvasCtrl.defaultFloor[0].id
                        });
                    }else {
                        console.log('no case finded');
                    }
                    dragingStarted = 0;
                }
            }

            if (canvasCtrl.speedDial.clickedButton === 'modify_zone'){
                dragingStarted++;
                drawedZones.forEach((zone) => {
                    if (dragingStarted === 1){
                        prevClick = canvas.canvasMouseClickCoords(event);
                        if (prevClick.x >= zone.topLeft.x - 5 && prevClick.x <= zone.topLeft.x + 10 && prevClick.y >= zone.topLeft.y - 5 && prevClick.y <= zone.topLeft.y + 10){
                            zoneToModify = zone;
                        }
                    }
                });

                zones.forEach((zone) => {
                    if (dragingStarted === 1){
                        prevClick = canvas.canvasMouseClickCoords(event);
                        let realHeight = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;

                        let virtualPositionTop    = scaleIconSize(zone.x_left, zone.y_up, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                        let virtualPositionBottom = scaleIconSize(zone.x_right, zone.y_down, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);

                        if (prevClick.x >= virtualPositionTop.width - 5 | 0 && prevClick.x <= virtualPositionTop.width + 10 | 0 && prevClick.y >= virtualPositionTop.height - 5 | 0 && prevClick.y <= virtualPositionTop.height + 10 | 0){
                            zoneToModify = {id: zone.id, topLeft: {x: virtualPositionTop.width, y: virtualPositionTop.height}, bottomRight: {x: virtualPositionBottom.width, y: virtualPositionBottom.height}, floor: canvasCtrl.defaultFloor[0].id};
                        }else if (zoneToModify === null) {
                            dragingStarted = 0;
                        }
                    }
                });

                if (dragingStarted === 2){
                    if (zoneToModify !== null) {
                        if (zoneToModify.id !== undefined) {
                            let topLeft     = null;
                            let bottomRight = null;
                            if (mouseDownCoords.x < zoneToModify.bottomRight.x && mouseDownCoords.y < zoneToModify.bottomRight.y) {
                                drawedZones.push({
                                    id         : zoneToModify.id,
                                    topLeft    : mouseDownCoords,
                                    bottomRight: zoneToModify.bottomRight,
                                    floor      : canvasCtrl.defaultFloor[0].id
                                })
                            } else if (mouseDownCoords.x > zoneToModify.bottomRight.x && mouseDownCoords.y < zoneToModify.bottomRight.y) {
                                topLeft     = {x: zoneToModify.bottomRight.x, y: mouseDownCoords.y};
                                bottomRight = {x: mouseDownCoords.x, y: zoneToModify.bottomRight.y};
                                drawedZones.push({
                                    id         : zoneToModify.id,
                                    topLeft    : topLeft,
                                    bottomRight: bottomRight,
                                    floor      : canvasCtrl.defaultFloor[0].id
                                })
                            } else if (mouseDownCoords.x < zoneToModify.bottomRight.x && mouseDownCoords.y > zoneToModify.bottomRight.y) {
                                topLeft     = {x: mouseDownCoords.x, y: zoneToModify.bottomRight.y};
                                bottomRight = {x: zoneToModify.bottomRight.x, y: mouseDownCoords.y};
                                drawedZones.push({
                                    id         : zoneToModify.id,
                                    topLeft    : topLeft,
                                    bottomRight: bottomRight,
                                    floor      : canvasCtrl.defaultFloor[0].id
                                })
                            } else if (mouseDownCoords.x > zoneToModify.bottomRight.x && mouseDownCoords.y > zoneToModify.bottomRight.y) {
                                drawedZones.push({
                                    id         : zoneToModify.id,
                                    topLeft    : zoneToModify.bottomRight,
                                    bottomRight: mouseDownCoords,
                                    floor      : canvasCtrl.defaultFloor[0].id
                                })
                            }

                            let modifiedZone = drawedZones.filter(z => z.id === zoneToModify.id)[0];

                            let topLeftScaled     = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, modifiedZone.topLeft.x, modifiedZone.topLeft.y);
                            let bottomDownScalled = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, modifiedZone.bottomRight.x, modifiedZone.bottomRight.y);

                            socketService.sendRequest('update_floor_zone', {
                                zone_id: zoneToModify.id,
                                x_left : topLeftScaled.x,
                                x_right: bottomDownScalled.x,
                                y_up   : topLeftScaled.y,
                                y_down : bottomDownScalled.y
                            })
                                .then((response) => {
                                    if (response.result.session_state)
                                        window.location.reload();

                                    // console.log(response);
                                })
                        } else {
                            let topLeft     = null;
                            let bottomRight = null;
                            if (mouseDownCoords.x < zoneToModify.bottomRight.x && mouseDownCoords.y < zoneToModify.bottomRight.y) {
                                drawedZones.push({
                                    topLeft    : mouseDownCoords,
                                    bottomRight: zoneToModify.bottomRight,
                                    floor      : canvasCtrl.defaultFloor[0].id
                                })
                            } else if (mouseDownCoords.x > zoneToModify.bottomRight.x && mouseDownCoords.y < zoneToModify.bottomRight.y) {
                                topLeft     = {x: zoneToModify.bottomRight.x, y: mouseDownCoords.y};
                                bottomRight = {x: mouseDownCoords.x, y: zoneToModify.bottomRight.y};
                                drawedZones.push({
                                    topLeft    : topLeft,
                                    bottomRight: bottomRight,
                                    floor      : canvasCtrl.defaultFloor[0].id
                                })
                            } else if (mouseDownCoords.x < zoneToModify.bottomRight.x && mouseDownCoords.y > zoneToModify.bottomRight.y) {
                                topLeft     = {x: mouseDownCoords.x, y: zoneToModify.bottomRight.y};
                                bottomRight = {x: zoneToModify.bottomRight.x, y: mouseDownCoords.y};
                                drawedZones.push({
                                    topLeft    : topLeft,
                                    bottomRight: bottomRight,
                                    floor      : canvasCtrl.defaultFloor[0].id
                                })
                            } else if (mouseDownCoords.x > zoneToModify.bottomRight.x && mouseDownCoords.y > zoneToModify.bottomRight.y) {
                                drawedZones.push({
                                    topLeft    : zoneToModify.bottomRight,
                                    bottomRight: mouseDownCoords,
                                    floor      : canvasCtrl.defaultFloor[0].id
                                })
                            }
                        }
                    }
                    zoneToModify = null;
                    dragingStarted = 0;
                }
            }

            if (canvasCtrl.speedDial.clickedButton === 'delete_zone'){
                let findedZones = findZone(mouseDownCoords, zones, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height);
                let findedDrawedZones = findDrawedZone(mouseDownCoords, drawedZones, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height);
                if (findedDrawedZones.length !== 0) {
                    drawedZones = drawedZones.filter(z => !findedDrawedZones.some(fz => angular.equals(z, fz)));
                }

                if (findedZones.length !== 0) {
                    socketService.sendRequest('delete_floor_zones', {zones: findedZones})
                        .then((response) => {
                            if (response.result.session_state)
                                window.location.reload();

                            zones = zones.filter(z => !findedZones.some(fz => fz === z.id));
                        })
                }
            }

            //listen for the tags click
            dataService.floorTags.forEach(function (tag) {
                let virtualTagPosition = scaleIconSize(tag.x_pos, tag.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                tagCloud               = groupNearTags(dataService.floorTags, tag);

                if (!dataService.isOutdoor(tag) && !canvasCtrl.switch.showDrawing) {
                    if (dataService.isElementAtClick(virtualTagPosition, mouseDownCoords, 45)) {
                        if (tagCloud.groupTags.length > 1) {
                            if (!dialogShown) {
                                $mdDialog.show({
                                    locals             : {tags: tagCloud.groupTags},
                                    templateUrl        : componentsPath + 'tags-info.html',
                                    parent             : angular.element(document.body),
                                    targetEvent        : event,
                                    clickOutsideToClose: true,
                                    controller         : ['$scope', 'tags', function ($scope, tags) {
                                        $scope.tags         = tags;
                                        $scope.isTagInAlarm = 'background-red';
                                        let tempAlarmTag    = [];

                                        $scope.tags.forEach(function (tagElem) {
                                            let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tagElem);
                                            tagAlarms.forEach(function (ta) {
                                                tempAlarmTag.push(ta);
                                            })
                                        });

                                        $scope.alarms = tempAlarmTag;

                                        $scope.hide = () => {
                                            $mdDialog.hide();
                                        }
                                    }]
                                })
                            }
                            dialogShown = true;
                        } else {
                            if (tag.tag_type_id === 1 || tag.tag_type_id === 14) {
                                if (!dataService.isTagOffline(tag)) {
                                    $mdDialog.show({
                                        locals             : {tag: tag},
                                        templateUrl        : componentsPath + 'tag-info.html',
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

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    })
                                }
                            } else if (dataService.checkIfTagHasAlarm(tag) || (new Date(Date.now()) - (new Date(tag.time)) < tag.sleep_time_indoor)) {
                                $mdDialog.show({
                                    locals             : {tag: tag},
                                    templateUrl        : componentsPath + 'tag-info.html',
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

                                        $scope.hide = () => {
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
                if (!isTagAtCoords(mouseDownCoords) && !canvasCtrl.switch.showDrawing) {
                    let virtualAnchorPosition = scaleIconSize(anchor.x_pos, anchor.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                    if (dataService.isElementAtClick(virtualAnchorPosition, mouseDownCoords, 20)) {

                        $mdDialog.show({
                            locals             : {anchor: anchor},
                            templateUrl        : componentsPath + 'anchor-info.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            controller         : ['$scope', 'anchor', function ($scope, anchor) {
                                $scope.anchor         = anchor;
                                $scope.isAnchorOnline = 'background-green';

                                if (!anchor.is_online) {
                                    $scope.isAnchorOnline = 'background-gray';
                                }

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        })
                    }
                }
            });

            //listen for the cameras click events
            dataService.cameras.forEach(function (camera) {
                if (!isTagAtCoords(mouseDownCoords) && !canvasCtrl.switch.showDrawing) {
                    let virtualCamerasPosition = scaleIconSize(camera.x_pos, camera.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                    if (dataService.isElementAtClick(virtualCamerasPosition, mouseDownCoords, 20)) {
                        $mdDialog.show({
                            templateUrl        : componentsPath + 'video-camera.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            controller         : ['$scope', function ($scope) {
                                $scope.camera = camera;

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        });
                    }
                }
            });
        }, false);

        //showing the info window with all the alarms
        $scope.showAlarms = function () {
            if (dataService.canvasInterval !== undefined){
                $interval.cancel(dataService.canvasInterval);
                dataService.canvasInterval = undefined;
            }
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'socketService', 'dataService', function ($scope, socketService, dataService) {
                    let tags      = dataService.allTags;
                    let locations = [];
                    $scope.alarms = [];
                    $scope.outlocationTags = dataService.switch.showOutrangeTags;

                    $scope.query  = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };


                    let id = ++requestId;
                    let id1, id2, id3 = -1;

                    socket.send(encodeRequestWithId(id, 'get_all_locations'));
                    socket.onmessage = (response) => {
                        let parsedResponse = parseResponse(response);
                        if (parsedResponse.id === id){
                            if (parsedResponse.session_state)
                                window.location.reload();

                            locations = parsedResponse.result;
                            dataService.getTagsLocation(tags, parsedResponse.result)
                                .then((response) => {
                                    response.forEach((tagAlarms) => {
                                        if (tagAlarms.length !== 0){
                                            tagAlarms.forEach((alarm) => {
                                                $scope.alarms.push(alarm);
                                            })
                                        }
                                    });
                                })
                        }
                    };

                    $scope.loadLocation = (alarm) => {
                        let tag = tags.filter(t => t.name === alarm.tag)[0];

                        let id1 = ++requestId;
                        let id2 = -1;

                        if (dataService.isOutdoor(tag)) {
                            locations.forEach((location) => {
                                if ((dataService.getTagDistanceFromLocationOrigin(tag, [location.latitude, location.longitude])) <= location.radius) {
                                    socket.send(encodeRequestWithId(id1, 'save_location', {location: location.name}));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse.id === id1) {
                                            if (parsedResponse.session_state)
                                                window.location.reload();

                                            if (parsedResponse.result === 'location_saved') {
                                                $mdDialog.hide();
                                                $state.go('outdoor-location')
                                            }
                                        }
                                    }
                                }
                            });
                        } else {
                            let indoorTag = dataService.userTags.filter(t => t.name === tag.name)[0];

                            if (tag === undefined) {
                                $mdDialog.hide();
                                $timeout(function () {
                                    $mdDialog.show({
                                        templateUrl        : componentsPath + 'tag-not-found-alert.html',
                                        parent             : angular.element(document.body),
                                        targetEvent        : event,
                                        clickOutsideToClose: true,
                                        controller         : ['$scope', '$controller', 'socketService', 'dataService', ($scope, $controller, socketService, dataService) => {
                                            $controller('languageController', {$scope: $scope});


                                            $scope.title   = lang.tagNotFound.toUpperCase();
                                            $scope.message = lang.tagNotLoggedUser;

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    })
                                }, 10);
                            }else {
                                id2 = ++requestId;
                                socket.send(encodeRequestWithId(id2, 'save_location', {location: indoorTag.location_name}));
                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    if (parsedResponse.id === id2) {
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        if (parsedResponse.result === 'location_saved') {
                                            dataService.defaultFloorName  = indoorTag.floor_name;
                                            dataService.locationFromClick = indoorTag.location_name;
                                            $mdDialog.hide();
                                            if (dataService.location.name !== indoorTag.location_name)
                                                window.location.reload();
                                        }
                                    }
                                }
                            }
                        }
                    };

                    //opening the map with the position of the tag out of location
                    //TODO I can create onbly one function that handle home and outdoor location alarms
                    $scope.loadTagPosition = (alarm) => {
                        $mdDialog.show({
                            locals             : {tagName: alarm, outerScope: $scope},
                            templateUrl        : componentsPath + 'search-tag-outside.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            controller         : ['$scope', 'NgMap', 'tagName', 'outerScope', 'socketService', function ($scope, NgMap, tagName, outerScope, socketService) {
                                $scope.isTagOutOfLocation = 'background-red';
                                $scope.locationName       = tagName.tag + ' ' + lang.tagOutSite.toUpperCase();
                                $scope.mapConfiguration   = {
                                    zoom    : 8,
                                    map_type: mapType,
                                };

                                let id1 = ++requestId;

                                let tag = tags.filter(t => t.name === tagName.tag)[0];
                                socket.send(encodeRequestWithId(id1, 'get_tag_outside_location_zoom'));
                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    if (parsedResponse.id === id1){
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        $scope.mapConfiguration.zoom = parsedResponse.result;
                                    }
                                };

                                NgMap.getMap('search-map').then((map) => {
                                    map.set('styles', mapConfiguration);
                                    let latLng = new google.maps.LatLng(tag.gps_north_degree, tag.gps_east_degree);

                                    map.setCenter(latLng);

                                    new google.maps.Marker({
                                        position: latLng,
                                        map     : map,
                                        icon    : tagsIconPath + 'search-tag.png'
                                    });

                                });

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        })
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function (event, removePromise) {
                    if (dataService.canvasInterval ===  undefined)
                        constantUpdateCanvas();
                }
            })
        };

        //function that control if the there is a tag at the coordinates passed as parameter
        let isTagAtCoords = (coords) => {
            return dataService.floorTags.some(function (tag) {
                let realHeight         = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;
                let virtualTagPosition = scaleIconSize(tag.x_pos, tag.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                return !dataService.isOutdoor(tag) && (((virtualTagPosition.width - 20) < coords.x && coords.x < (virtualTagPosition.width + 20)) && ((virtualTagPosition.height - 20) < coords.y && coords.y < (virtualTagPosition.height + 20)));
            })
        };

        //showing the info window with the online/offline tags
        $scope.showOfflineTagsIndoor = () => {
            if (dataService.canvasInterval !== undefined){
                $interval.cancel(dataService.canvasInterval);
                dataService.canvasInterval = undefined;
                dataService.showOfflineTags('canvas', constantUpdateCanvas, null);
            }
        };

        //showing the info window with the online/offline anchors
        $scope.showOfflineAnchorsIndoor = () => {
            if (dataService.canvasInterval !== undefined) {
                $interval.cancel(dataService.canvasInterval);
                dataService.canvasInterval = undefined;
                dataService.showOfflineAnchorsIndoor('canvas', constantUpdateCanvas, null);
            }
        };

        //functionthat handles the emergency zone dialog
        $scope.showEmergencyZone = () => {
            $mdDialog.show({
                locals             : {floor: canvasCtrl.defaultFloor[0].name, tags: dataService.floorTags},
                templateUrl        : componentsPath + 'emergency-alarm-info.html',
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
                    $scope.labels = [lang.personInEvacuationZone, lang.lostPersons];

                    let id = ++requestId;
                    socket.send(encodeRequestWithId(id, 'get_emergency_info', {location: dataService.location.name, floor: floor}));
                    socket.onmessage = (response) => {
                        let parsedResponse = parseResponse(response);
                        if (parsedResponse.id === id) {
                            if (parsedResponse.session_state)
                                window.location.reload();

                            $scope.safeTags   = parsedResponse.result;
                            $scope.unsafeTags = tags.filter(t => !parsedResponse.result.some(i => i.tag_name === t.name));

                            $scope.men.safe   = parsedResponse.result.length;
                            $scope.men.unsafe = tags.length - parsedResponse.result.length;

                            $scope.data = [$scope.men.safe, $scope.men.unsafe];
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        //function that returns you to home
        canvasCtrl.goHome = () => {
            dataService.goHome();
        };

        //freeing the resources on page destroy
        $scope.$on("$destroy", function () {
            $mdDialog.hide();
            $interval.cancel(dataService.canvasInterval);
            dataService.canvasInterval = undefined;
        });
    }

    /**
     * Function that handle the menu interaction
     * @type {string[]}
     */
    menuController.$inject = ['$rootScope', '$scope', '$mdDialog', '$mdEditDialog', '$location', '$state', '$filter', '$timeout', '$mdSidenav', '$interval', '$element', 'NgMap', 'dataService', 'socketService'];

    function menuController($rootScope, $scope, $mdDialog, $mdEditDialog, $location, $state, $filter, $timeout, $mdSidenav, $interval, $element, NgMap, dataService, socketService) {

        let socket = socketService.getSocket();
        $scope.menuTags    = dataService.allTags;
        $scope.isAdmin     = dataService.isAdmin;
        $scope.isUserManager     = dataService.isUserManager;
        $scope.selectedTag = '';
        $scope.selectedLocation = '';
        $scope.zoneColor = '';
        $scope.userRole = '';

        $scope.switch      = {
            mapFullscreen: false,
            showOutdoorRectDrawing: false,
            showOutdoorRoundDrawing: false
        };

        $scope.getAllWetags = () => {
            let id1 = ++requestId;

            socket.send(encodeRequestWithId(id1, 'get_all_tags'));
            socket.onmessage = (response) => {
                let parsedResponse = parseResponse(response);
                if (parsedResponse.id === id1) {
                    if (parsedResponse.session_state)
                        window.location.reload();

                    $scope.menuTags = parsedResponse.result;
                }
            }
        };

        $scope.getUserLocations = () => {
            let id1 = ++requestId;

            socket.send(encodeRequestWithId(id1, 'get_user_locations', {user: dataService.user.id}));
            socket.onmessage = (response) => {
                let parsedResponse = parseResponse(response);
                if (parsedResponse.id === id1) {
                    if (parsedResponse.session_state)
                        window.location.reload();

                    $scope.locations = parsedResponse.result;
                }
            }
        };

        //opening and closing the menu
        $scope.toggleLeft = () => {
            $mdSidenav('left').toggle();
        };

        //function that show the locations table
        $scope.openLocations = () => {
            $interval.cancel(dataService.homeTimer);
            dataService.homeTimer = undefined;

            let locationsHasChanged     = false;
            let locationsHasBeenDeleted = false;

            let locationDialog = {
                locals             : {admin: $scope.isAdmin, userManager: $scope.isUserManager},
                templateUrl        : componentsPath + 'locations-table.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', 'admin', 'userManager', function ($scope, admin, userManager) {
                    $scope.selected       = [];
                    $scope.locationsTable = [];
                    $scope.isAdmin = admin;
                    $scope.isUserManager = userManager;
                    $scope.tableEmpty     = false;
                    $scope.query          = {
                        limitOptions: [5, 10, 15],
                        limit       : 5,
                        page        : 1
                    };

                    let id = ++requestId;
                    socket.send(encodeRequestWithId(id, 'get_locations_by_user', {user: dataService.user.username}));
                    socket.onmessage = (response) => {
                        let parsedResponse = parseResponse(response);
                        if (parsedResponse.id === id) {
                            if (parsedResponse.session_state)
                                window.location.reload();

                            $scope.locationsTable = parsedResponse.result;
                            updateLocationsTable();
                        }
                    };

                    let updateLocationsTable = () => {
                        let id1 = ++requestId;
                        socket.send(encodeRequestWithId(id1, 'get_locations_by_user', {user: dataService.user.username}));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id1) {
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                if (!angular.equals($scope.locationsTable, parsedResponse.result)) {
                                    $scope.locationsTable = parsedResponse.result;
                                    $scope.tableEmpty     = $scope.locationsTable.length === 0;
                                    locationsHasChanged = true;
                                    $scope.$apply();
                                }
                            }
                        }
                    };

                    $rootScope.$on('updateLocationsTable', function () {
                        updateLocationsTable();
                    });

                    let id1 = -1;

                    // socket.send(encodeRequestWithId(id, 'get_locations_by_user', {user: dataService.user.username}));
                    // socket.onmessage = (response) => {
                    //     let parsedResponse = parseResponse(response);
                    //     if (parsedResponse.id === id) {
                    //         $scope.locationsTable = parsedResponse.result;
                    //         $scope.tableEmpty     = $scope.locationsTable.length === 0;
                    //
                    //         dataService.mapInterval = $interval(function () {
                    //             id1 = ++requestId;
                    //             socket.send(encodeRequestWithId(id1, 'get_locations_by_user', {user: dataService.user.username}));
                    //             socket.onmessage = (response) => {
                    //                 let parsedResponse = parseResponse(response);
                    //                 if (parsedResponse.id === id1) {
                    //                     $scope.tableEmpty = $scope.locationsTable.length === 0;
                    //                     if (!angular.equals($scope.locationsTable, parsedResponse.result)) {
                    //                         locationsHasChanged   = true;
                    //                         $scope.locationsTable = parsedResponse.result;
                    //                     }
                    //
                    //                     if (angular.element(document).find('md-dialog').length === 0) {
                    //                         if (locationsHasChanged || locationsHasBeenDeleted) {
                    //                             locationsHasChanged     = false;
                    //                             locationsHasBeenDeleted = false;
                    //                             window.location.reload();
                    //                         }
                    //                         $interval.cancel(dataService.mapInterval);
                    //                     }
                    //                 }
                    //             }
                    //         },1000)
                    //     }
                    // };

                    $scope.editCell = (event, location, locationName) => {

                        event.stopPropagation();

                        if (admin || userManager) {
                            let editCell = {
                                modelValue : location[locationName],
                                save       : function (input) {
                                    input.$invalid         = true;
                                    location[locationName] = input.$modelValue;
                                    let id2 = ++requestId;
                                    socket.send(encodeRequestWithId(id2, 'change_location_field', {
                                        location_id   : location.id,
                                        location_field: locationName,
                                        field_value   : input.$modelValue
                                    }));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse.id === id2){
                                            if (parsedResponse.session_state)
                                                window.location.reload();
                                        }
                                        //TODO handle if the field is not saved
                                    };
                                },
                                targetEvent: event,
                                title      : lang.insertValue,
                                validators : {
                                    'md-maxlength': 30
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //deleting a location
                    $scope.deleteRow = (location) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteSite.toUpperCase())
                            .textContent(lang.okDeleteSite)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteSite.toUpperCase())
                            .cancel(lang.cancel.toUpperCase());


                        let id3 = ++requestId;

                        $mdDialog.show(confirm).then(() => {
                            socket.send(encodeRequestWithId(id3, 'delete_location', {location_id: location.id}));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id3){
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result.length === 0) {
                                        $scope.locationsTable   = $scope.locationsTable.filter(t => t.id !== location.id);
                                        $rootScope.$emit('updateLocationsTable', {})
                                        locationsHasChanged = true;
                                        $scope.$apply();
                                    }
                                }
                            };
                        }, function () {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //adding a location
                    $scope.addNewRow = () => {
                        $mdDialog.show(addLocationDialog);
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function(event, removePromise){
                    if (dataService.homeTimer === undefined && !locationsHasChanged){
                        NgMap.getMap('main-map').then((map) => {
                            $rootScope.$emit('constantUpdateNotifications', map);
                        })
                    }
                    if (locationsHasChanged){
                        locationsHasChanged     = false;
                        locationsHasBeenDeleted = false;
                        window.location.reload();
                    }
                }
            };

            $mdDialog.show(locationDialog);

            let addLocationDialog = {
                templateUrl        : componentsPath + 'insert-location.html',
                parent             : angular.element(document.body),
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', function ($scope) {
                    let fileInput = null;

                    $scope.location = {
                        name       : '',
                        description: '',
                        latitude   : '',
                        longitude  : '',
                        radius     : 0,
                        meterRadius     : 0,
                        showSuccess: false,
                        showError  : false,
                        isIndoor   : false,
                        message    : '',
                        resultClass: ''
                    };

                    //insert location dialog
                    $scope.insertLocation = (form) => {
                        form.$submitted = true;

                        if (form.$valid) {
                            let file     = null;
                            let fileName = null;

                            if (fileInput != null && fileInput.files.length !== 0) {
                                file     = fileInput.files[0];
                                fileName = file.name;
                            }

                            let id5 = ++requestId;
                            let id6 = -1;

                            socket.send(encodeRequestWithId(id5, 'insert_location', {
                                user       : dataService.user.id,
                                name       : $scope.location.name,
                                description: $scope.location.description,
                                latitude   : $scope.location.latitude,
                                longitude  : $scope.location.longitude,
                                imageName  : (fileName === null) ? '' : fileName,
                                radius     : ($scope.location.isIndoor) ? '' : $scope.location.radius,
                                meterRadius     : ($scope.location.isIndoor) ? '' : $scope.location.meterRadius,
                                is_indoor  : $scope.location.isIndoor
                            }));

                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id5) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result.length === 0) {
                                        if (file != null) {
                                            convertImageToBase64(file)
                                                .then((response) => {
                                                    if (response !== null) {
                                                        id6 = ++requestId;
                                                        socket.send(encodeRequestWithId(id6, 'save_marker_image', {
                                                            imageName: fileName,
                                                            image    : response
                                                        }));
                                                    }
                                                })
                                        } else {
                                            $scope.location.showSuccess = true;
                                            $scope.location.showError   = false;
                                            $scope.location.message     = lang.positionInsertedWithoutImage;
                                            $scope.location.resultClass = 'background-orange';
                                            $rootScope.$emit('updateLocationsTable', {});
                                            $scope.$apply();
                                            $timeout(function () {
                                                $mdDialog.hide();
                                            }, 1000);
                                        }
                                    } else {
                                        $scope.location.showSuccess = false;
                                        $scope.location.showError   = true;
                                        $scope.location.message     = lang.impossibleToInsertPosition;
                                        $scope.location.resultClass = 'background-red';
                                        $scope.$apply();
                                        return null
                                    }
                                } else if (parsedResponse.id === id6) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result === false) {
                                        $scope.location.showSuccess = false;
                                        $scope.location.showError   = true;
                                        $scope.location.message     = lang.positionInsertedWithoutImage;
                                        $scope.location.resultClass = 'background-orange';
                                        $rootScope.$emit('updateLocationsTable', {});
                                        $scope.$apply();

                                        $timeout(function () {
                                            $mdDialog.hide();
                                        }, 1000);
                                    } else {
                                        $scope.location.resultClass = 'background-green';
                                        $scope.location.showSuccess = true;
                                        $scope.location.showError   = false;
                                        $scope.location.message     = lang.positionInserted;
                                        $rootScope.$emit('updateLocationsTable', {});
                                        $scope.$apply();

                                        $timeout(function () {
                                            $mdDialog.hide();
                                        }, 1000);
                                    }
                                }
                            }

                        } else {
                            $scope.location.resultClass = 'background-red';
                        }
                    };

                    $scope.uploadMarkerImage = () => {
                        fileInput = document.getElementById('marker-image');
                        fileInput.click();
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            }
        };

        $scope.openUserManager = function() {
            $interval.cancel(dataService.homeTimer);
            dataService.homeTimer = undefined;
            let usersDialog = {
                locals             : {admin: $scope.isAdmin, userManager: $scope.isUserManager},
                templateUrl        : componentsPath + 'users-table.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', 'admin', 'userManager', function ($scope, admin, userManager) {
                    $scope.title = "UTENTI";
                    $scope.selected       = [];
                    $scope.usersTable = [];
                    $scope.isAdmin = admin;
                    $scope.isUserManager = userManager;
                    $scope.tableEmpty     = false;
                    $scope.query          = {
                        limitOptions: [5, 10, 15],
                        limit       : 5,
                        page        : 1
                    };

                    let updateIntermediateUserTable = () => {
                        let id1 = ++requestId;
                        socket.send(encodeRequestWithId(id1, 'get_generic_users'));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id1){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                $scope.usersTable = parsedResponse.result;
                                $scope.tableEmpty = $scope.usersTable.length === 0;
                                $scope.$apply();
                            }
                        };
                    };

                    updateIntermediateUserTable();

                    $rootScope.$on('updateIntermediateUserTable', function () {
                        updateIntermediateUserTable()
                    });

                    $scope.manageLocations = (user) => {
                        let manageLocationDialog = {
                            locals             : {user: user},
                            templateUrl        : componentsPath + 'manage-locations.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            multiple: true,
                            controller         : ['$scope', 'user', function ($scope, user) {

                                $scope.locations = [];
                                $scope.tableEmpty = false;
                                let id2 = ++requestId;

                                socket.send(encodeRequestWithId(id2, 'get_user_locations', {
                                    user: user.id
                                }));

                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    if (parsedResponse.id === id2){
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        $scope.locations = parsedResponse.result;
                                        $scope.tableEmpty = $scope.locations.length === 0;
                                    }
                                };

                                //inserting a mac
                                $scope.manageNewLocation = () => {
                                    $mdDialog.hide();
                                    $mdDialog.show({
                                        templateUrl        : componentsPath + 'insert-managed-location.html',
                                        parent             : angular.element(document.body),
                                        targetEvent        : event,
                                        clickOutsideToClose: true,
                                        multiple           : true,
                                        controller         : ['$scope', function ($scope) {


                                            let locationsIds = [];

                                            $scope.insertManagedLocations = {
                                                resultClass: '',
                                                selectedLocations: [],
                                                allLocations: []
                                            };

                                            let id3 = ++requestId;
                                            socket.send(encodeRequestWithId(id3, 'get_all_locations'));
                                            socket.onmessage = (response) => {
                                                let parsedResponse = parseResponse(response);
                                                if (parsedResponse.id === id3){
                                                    if (parsedResponse.session_state)
                                                        window.location.reload();

                                                    $scope.insertManagedLocations.allLocations = parsedResponse.result;
                                                }
                                            };

                                            $scope.addManagedLocation = (form) => {
                                                form.$submitted = true;

                                                if (form.$valid) {

                                                    $scope.insertManagedLocations.allLocations.filter(l => $scope.insertManagedLocations.selectedLocations.some(sl => sl === l.name))
                                                        .forEach((location) => {
                                                            locationsIds.push(location.id);
                                                        });

                                                    let id4 = ++requestId;
                                                    socket.send(encodeRequestWithId(id4, 'insert_managed_location', {
                                                        user  : user.id,
                                                        locations  : locationsIds,
                                                    }));
                                                    socket.onmessage = (response) => {
                                                        let parsedResponse = parseResponse(response);
                                                        if (parsedResponse.id === id4){
                                                            if (parsedResponse.session_state)
                                                                window.location.reload();

                                                            $mdDialog.hide();
                                                            $mdDialog.show(manageLocationDialog);
                                                        }
                                                    };
                                                } else {
                                                    $scope.insertManagedLocations.resultClass = 'background-red';
                                                }
                                            };

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    });
                                };

                                //deleting tag
                                $scope.deleteManagedLocation = (location) => {
                                    let confirm = $mdDialog.confirm()
                                        .title(lang.deleteLocation.toUpperCase())
                                        .textContent(lang.deleteLocationText)
                                        .targetEvent(event)
                                        .multiple(true)
                                        .ok(lang.deleteLocation)
                                        .cancel(lang.cancel);

                                    $mdDialog.show(confirm).then(() => {
                                        let id5 = ++requestId;
                                        socket.send(encodeRequestWithId(id5, 'delete_managed_location', {
                                            user: user.id,
                                            location_id: location.id
                                        }));
                                        socket.onmessage = (response) => {
                                            let parsedResponse = parseResponse(response);
                                            if (parsedResponse.id === id5){
                                                if (parsedResponse.session_state)
                                                    window.location.reload();

                                                if (parsedResponse.result === 1) {
                                                    $scope.locations = $scope.locations.filter(l => l.id !== location.id);
                                                    $scope.$apply();
                                                }
                                            }
                                        };
                                    }, function () {
                                        console.log('CANCELLATO!!!!');
                                    });
                                };

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        };

                        $mdDialog.show(manageLocationDialog);
                    };

                    $scope.editCell = (event, user, userName) => {

                        event.stopPropagation();

                        if (admin  || userManager) {
                            let editCell = {
                                modelValue : user[userName],
                                save       : function (input) {
                                    input.$invalid         = true;
                                    user[userName] = input.$modelValue;
                                    let id3 = ++requestId;
                                    socket.send(encodeRequestWithId(id3, 'change_user_field', {
                                        user_id   : user.id,
                                        user_field: userName,
                                        field_value   : input.$modelValue
                                    }));

                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse.id === id3){
                                            if (parsedResponse.session_state)
                                                window.location.reload();
                                        }
                                    };
                                },
                                targetEvent: event,
                                title      : lang.insertValue,
                                validators : {
                                    'md-maxlength': 30
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //deleting a location
                    $scope.deleteRow = (user) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.cancelUser.toUpperCase())
                            .textContent(lang.cancelUserText)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.cancelUser)
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(() => {
                            let id4 = ++requestId;
                            socket.send(encodeRequestWithId(id4, 'delete_user', {user_id: user.id}));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id4){
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (response.result !== 0) {
                                        $scope.usersTable   = $scope.usersTable.filter(u => u.id !== user.id);
                                        $scope.$apply();
                                    }
                                }
                            };
                        }, function () {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //adding a location
                    $scope.addNewRow = () => {
                        $mdDialog.show(addUserDialog);
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function () {
                    $interval.cancel(dataService.usersInterval);
                    if (dataService.homeTimer === undefined){
                        NgMap.getMap('main-map').then((map) => {
                            $rootScope.$emit('constantUpdateNotifications', map);
                        })
                    }
                }
            };

            $mdDialog.show(usersDialog);

            let addUserDialog = {
                templateUrl        : componentsPath + 'insert-user.html',
                parent             : angular.element(document.body),
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', function ($scope) {
                    $scope.user = {
                        username       : '',
                        name: '',
                        email: '',
                        showSuccess: false,
                        showError  : false,
                        isIndoor   : false,
                        message    : '',
                        resultClass: ''
                    };

                    //insert location dialog
                    $scope.insertUser = (form) => {
                        form.$submitted = true;

                        if (form.$valid) {
                            let id5 = ++requestId;
                            socket.send(encodeRequestWithId(id5, 'insert_user', {
                                username: $scope.user.username,
                                name: $scope.user.name,
                                email: $scope.user.email
                            }));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id5){
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result.length === 0){
                                        $scope.user.resultClass = 'background-green';
                                        $scope.user.showSuccess = true;
                                        $scope.user.showError   = false;
                                        $scope.user.message     = lang.userInserted;

                                        $scope.$apply();

                                        $timeout(function () {
                                            $mdDialog.hide();
                                            $rootScope.$emit('updateIntermediateUserTable', {});
                                        }, 1000);
                                    }else{
                                        $scope.user.showSuccess = false;
                                        $scope.user.showError   = true;
                                        $scope.user.message     = lang.canInsertUser;
                                        $scope.user.resultClass = 'background-red';
                                        $scope.$apply();
                                    }
                                }
                            };
                        } else {
                            $scope.user.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            }
        };

        $scope.openSuperuserManager = function() {
            $interval.cancel(dataService.homeTimer);
            dataService.homeTimer = undefined;
            let userId = null;
            let superUsersDialog = {
                locals             : {admin: $scope.isAdmin, userManager: $scope.isUserManager},
                templateUrl        : componentsPath + 'users-table.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', 'admin', 'userManager', function ($scope, admin, userManager) {
                    $scope.title = lang.users.toUpperCase();
                    $scope.selected       = [];
                    $scope.usersTable = [];
                    $scope.isAdmin = admin;
                    $scope.userRole = '';
                    $scope.isUserManager = userManager;
                    $scope.tableEmpty     = false;
                    $scope.query          = {
                        limitOptions: [5, 10, 15],
                        limit       : 5,
                        page        : 1
                    };

                    $scope.updateUserRole = (user, userRole) => {

                        if (user.role !== userRole.toString()) {
                            let id = ++requestId;
                            socket.send(encodeRequestWithId(id, 'update_user_role', {user: user.id, role: userRole}));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse === id){
                                    if (parsedResponse.session_state)
                                        window.location.reload();
                                }
                            }
                        }
                    };

                    let updateUserTable = () => {
                        let id = ++requestId;
                        socket.send(encodeRequestWithId(id, 'get_all_users'));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                $scope.usersTable = parsedResponse.result;
                                $scope.tableEmpty     = $scope.usersTable.length === 0;
                                $scope.$apply();
                            }
                        };
                    };

                    updateUserTable();

                    $rootScope.$on('updateUserTable', function () {
                        updateUserTable();
                    });

                    $scope.manageLocations = (user) => {
                        userId = user.id;

                        let manageLocationDialog = {
                            locals             : {user: user},
                            templateUrl        : componentsPath + 'manage-locations.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            multiple: true,
                            controller         : ['$scope', 'user', function ($scope, user) {

                                $scope.locations = [];
                                $scope.user = user;

                                $scope.tableEmpty     = false;
                                $scope.query          = {
                                    limitOptions: [5, 10, 15],
                                    limit       : 5,
                                    page        : 1
                                };

                                let id2 = ++requestId;
                                socket.send(encodeRequestWithId(id2, 'get_user_locations', {user: user.id}));
                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    if (parsedResponse.id === id2){
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        $scope.locations = parsedResponse.result;
                                    }
                                };

                                //inserting a mac
                                $scope.manageNewLocation = () => {
                                    $mdDialog.hide();
                                    $mdDialog.show({
                                        templateUrl        : componentsPath + 'insert-managed-location.html',
                                        parent             : angular.element(document.body),
                                        targetEvent        : event,
                                        clickOutsideToClose: true,
                                        multiple           : true,
                                        controller         : ['$scope', function ($scope) {


                                            let locationsIds = [];

                                            $scope.insertManagedLocations = {
                                                resultClass: '',
                                                selectedLocations: [],
                                                allLocations: []
                                            };

                                            let id3 = ++requestId;
                                            socket.send(encodeRequestWithId(id3, 'get_all_locations'));
                                            socket.onmessage = (response) => {
                                                let parsedResponse = parseResponse(response);
                                                if (parsedResponse.id === id3){
                                                    if (parsedResponse.session_state)
                                                        window.location.reload();

                                                    $scope.insertManagedLocations.allLocations = parsedResponse.result;
                                                }
                                            };

                                            $scope.addManagedLocation = (form) => {
                                                form.$submitted = true;

                                                if (form.$valid) {

                                                    $scope.insertManagedLocations.allLocations.filter(l => $scope.insertManagedLocations.selectedLocations.some(sl => sl === l.name))
                                                        .forEach((location) => {
                                                            locationsIds.push(location.id);
                                                        });

                                                    let id4 = ++requestId;
                                                    socket.send(encodeRequestWithId(id4, 'insert_managed_location', {
                                                        user  : user.id,
                                                        locations  : locationsIds,
                                                    }));
                                                    socket.onmessage = (response) => {
                                                        let parsedResponse = parseResponse(response);
                                                        if (parsedResponse.id === id4){
                                                            if (parsedResponse.session_state)
                                                                window.location.reload();

                                                            $mdDialog.hide();
                                                            $mdDialog.show(manageLocationDialog);
                                                        }
                                                    };
                                                } else {
                                                    $scope.insertManagedLocations.resultClass = 'background-red';
                                                }
                                            };

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    });
                                };

                                //deleting tag
                                $scope.deleteManagedLocation = (location) => {
                                    let confirm = $mdDialog.confirm()
                                        .title(lang.deleteLocation.toUpperCase())
                                        .textContent(lang.deleteLocationText)
                                        .targetEvent(event)
                                        .multiple(true)
                                        .ok(lang.deleteLocation)
                                        .cancel(lang.cancel);

                                    $mdDialog.show(confirm).then(() => {
                                        let id5 = ++requestId;
                                        socket.send(encodeRequestWithId(id5, 'delete_managed_location', {
                                            user: user.id,
                                            location_id: location.id
                                        }));
                                        socket.onmessage = (response) => {
                                            let parsedResponse = parseResponse(response);
                                            if (parsedResponse.id === id5){
                                                if (parsedResponse.session_state)
                                                    window.location.reload();

                                                if (parsedResponse.result === 1) {
                                                    $scope.locations = $scope.locations.filter(l => l.id !== location.id);
                                                    $scope.$apply();
                                                }
                                            }
                                        };
                                    }, function () {
                                        console.log('CANCELLATO!!!!');
                                    });
                                };

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        };

                        $mdDialog.show(manageLocationDialog);
                    };


                    $scope.editCell = (event, superUser, superUserName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue : superUser[superUserName],
                                save       : function (input) {
                                    input.$invalid         = true;
                                    superUser[superUserName] = input.$modelValue;
                                    let id6 = ++requestId;
                                    socket.send(encodeRequestWithId(id6, 'change_super_user_field', {
                                        super_user_id   : superUser.id,
                                        super_user_field: superUserName,
                                        field_value   : input.$modelValue
                                    }));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse.id === id6) {
                                            if (parsedResponse.session_state)
                                                window.location.reload();

                                            if (response.result !== 1)
                                                console.log(response.result);
                                        }

                                    };
                                },
                                targetEvent: event,
                                title      : lang.insertValue,
                                validators : {
                                    'md-maxlength': 30
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //deleting a location
                    $scope.deleteRow = (user) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.cancelUser.toUpperCase())
                            .textContent(lang.cancelUserText)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.cancelUser)
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(() => {
                            let id7 = ++requestId;
                            socket.send(encodeRequestWithId(id7, 'delete_super_user', {
                                user_id: user.id
                            }));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id7) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result !== 0) {
                                        updateUserTable();
                                    }
                                }
                            };
                        }, function () {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //adding a location
                    $scope.addNewRow = () => {
                        $mdDialog.show(addSuperUserDialog);
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function () {
                    $interval.cancel(dataService.superUsersInterval);
                    if (dataService.homeTimer === undefined){
                        NgMap.getMap('main-map').then((map) => {
                            $rootScope.$emit('constantUpdateNotifications', map);
                        })
                    }
                }
            };

            $mdDialog.show(superUsersDialog);

            let addSuperUserDialog = {
                templateUrl        : componentsPath + 'insert-super-user.html',
                parent             : angular.element(document.body),
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', '$interval', 'dataService', function ($scope, $interval, dataService) {
                    $scope.roles = [lang.genericUser, lang.intermediateUser];
                    $scope.userRole = '';
                    $scope.user = {
                        username       : '',
                        name: '',
                        email: '',
                        showSuccess: false,
                        showError  : false,
                        isIndoor   : false,
                        message    : '',
                        resultClass: ''
                    };

                    //insert location dialog
                    $scope.insertUser = (form) => {
                        form.$submitted = true;

                        if (form.$valid) {
                            let id8 = ++requestId;
                            socket.send(encodeRequestWithId(id8, 'insert_super_user', {
                                username: $scope.user.username,
                                name: $scope.user.name,
                                email: $scope.user.email,
                                role: ($scope.userRole === 'Utente generico') ? 0 : 2
                            }));

                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id8) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result.length === 0){
                                        $scope.user.resultClass = 'background-green';
                                        $scope.user.showSuccess = true;
                                        $scope.user.showError   = false;
                                        $scope.user.message     = lang.userInserted;

                                        $scope.$apply();

                                        $timeout(function () {
                                            $mdDialog.hide();
                                        }, 1000);
                                    }else{
                                        $scope.user.showSuccess = false;
                                        $scope.user.showError   = true;
                                        $scope.user.message     = lang.canInsertUser;
                                        $scope.user.resultClass = 'background-red';
                                        $scope.$apply();
                                    }
                                }
                            };
                        } else {
                            $scope.user.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function (event, removePromise) {
                    if (dataService.superUsersInterval === undefined)
                        $rootScope.$emit('updateUserTable', {});
                }
            }
        };

        //history table
        $scope.viewHistory = function (position) {
            if (dataService.homeTimer !== undefined) {
                $interval.cancel(dataService.homeTimer);
                dataService.homeTimer = undefined;
            }

            if (dataService.canvasInterval !== undefined) {
                $interval.cancel(dataService.canvasInterval);
                dataService.canvasInterval = undefined;
            }

            $mdDialog.show({
                templateUrl        : componentsPath + 'history-table.html',
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
                        tags         : dataService.allTags,
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
                    $scope.deleteHistory = () => {
                        let fromDate = $filter('date')($scope.history.fromDate, 'yyyy-MM-dd');
                        let toDate   = $filter('date')($scope.history.toDate, 'yyyy-MM-dd');
                        let id = ++requestId;
                        let id1 = -1;
                        socket.send(encodeRequestWithId(id, 'delete_history', {fromDate: fromDate, toDate: toDate}));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                if (parsedResponse.result !== 0){
                                    id1 = ++requestId;
                                    socket.send(encodeRequestWithId(id1, 'get_history', {
                                        fromDate: fromDate,
                                        toDate  : toDate,
                                        tag     : $scope.history.selectedTag,
                                        event   : $scope.history.selectedEvent
                                    }))
                                }
                            }else if (parsedResponse.id === id1){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                $scope.historyRows = parsedResponse.result;
                                $scope.tableEmpty  = $scope.historyRows.length === 0;
                                $scope.$apply();
                            }
                        }
                    };

                    $scope.$watchGroup(['history.fromDate', 'history.toDate', 'history.selectedTag', 'history.selectedEvent'], function (newValues) {
                        let fromDate = $filter('date')(newValues[0], 'yyyy-MM-dd');
                        let toDate   = $filter('date')(newValues[1], 'yyyy-MM-dd');

                        let id = ++requestId;
                        let id1, id2 = -1;

                        socket.send(encodeRequestWithId(id, 'get_events'));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id) {
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                $scope.history.events = parsedResponse.result;
                                id1                 = ++requestId;
                                socket.send(encodeRequestWithId(id1, 'get_history', {
                                    fromDate: fromDate,
                                    toDate  : toDate,
                                    tag     : newValues[2],
                                    event   : newValues[3]
                                }))
                            } else if (parsedResponse.id === id1){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                $scope.historyRows = parsedResponse.result;
                                $scope.tableEmpty  = $scope.historyRows.length === 0;
                                $scope.$apply();
                            }
                        };
                    });

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function (event, removePromise) {
                    if (dataService.homeTimer === undefined && position === 'home'){
                        NgMap.getMap('main-map').then((map) => {
                            $rootScope.$emit('constantUpdateNotifications', map)
                        });
                    }
                    if (dataService.canvasInterval === undefined && position === 'canvas'){
                        $rootScope.$emit('constantUpdateCanvas')
                    }
                }
            });
        };

        $scope.viewVersions = () => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'versions.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', function ($scope) {

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]

            });
        };


        //function that handles the password change
        $scope.changePassword = () => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'change-password.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', function ($scope) {
                    $scope.title = lang.changePassword;
                    $scope.changePassword = {
                        oldPassword  : '',
                        newPassword  : '',
                        reNewPassword: '',
                        resultClass  : '',
                        showSuccess  : false,
                        showError    : false,
                        message      : false
                    };

                    $scope.sendPassword = (form) => {
                        form.$submitted = true;

                        if ($scope.changePassword.newPassword !== $scope.changePassword.reNewPassword) {
                            $scope.changePassword.resultClass = 'background-red';
                            $scope.changePassword.showError   = true;
                            $scope.changePassword.showSuccess = false;
                            $scope.changePassword.message     = lang.passwordNotEqual;
                        } else {
                            if (form.$valid) {

                                let id = ++requestId;

                                socket.send(encodeRequestWithId(id, 'change_password', {
                                    oldPassword: $scope.changePassword.oldPassword,
                                    newPassword: $scope.changePassword.newPassword
                                }));
                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    if (parsedResponse.id === id){
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        if (parsedResponse.result === 'wrong_old') {
                                            $scope.changePassword.resultClass = 'background-red';
                                            $scope.changePassword.showError   = true;
                                            $scope.changePassword.showSuccess = false;
                                            $scope.changePassword.message     = lang.invalidOld;
                                        } else if (parsedResponse.result === 'error_on_changing_password') {
                                            $scope.changePassword.resultClass = 'background-red';
                                            $scope.changePassword.showSuccess = false;
                                            $scope.changePassword.showError   = true;
                                            $scope.changePassword.message     = lang.impossibleChangePassword
                                            $timeout(function () {
                                                $mdDialog.hide();
                                            }, 1000);
                                        } else {
                                            $scope.changePassword.resultClass = 'background-green';
                                            $scope.changePassword.showSuccess = true;
                                            $scope.changePassword.showError   = false;
                                            $scope.changePassword.message     = lang.passwordChanged;
                                            $timeout(function () {
                                                $mdDialog.hide();
                                            }, 1000);
                                        }
                                        $scope.$apply();
                                    }
                                };
                            } else {
                                $scope.changePassword.resultClass = 'background-red';
                            }
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            });
        };

        //function that handle the tags crud
        $scope.registry = (position) => {
            if (dataService.homeTimer !== undefined) {
                $interval.cancel(dataService.homeTimer);
                dataService.homeTimer = undefined;
            }
            if (dataService.canvasInterval !== undefined){
                $interval.cancel(dataService.canvasInterval);
                dataService.canvasInterval = undefined;
            }
            if (dataService.updateMapTimer !== undefined){
                $interval.cancel(dataService.updateMapTimer);
                dataService.updateMapTimer = undefined;
            }

            $scope.clickedTag = null;

            let addRowDialog = {
                templateUrl        : componentsPath + 'insert-tags-row.html',
                parent             : angular.element(document.body),
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', function ($scope) {

                    $scope.tagTypes     = [];
                    $scope.selectedType = '';
                    $scope.insertTag    = {
                        name       : '',
                        type       : '',
                        mac        : '',
                        resultClass: '',
                    };

                    let macs = [];

                    let id = ++requestId;

                    socket.send(encodeRequestWithId(id, "get_all_types"));
                    socket.onmessage = (response) => {
                        let parsedResponse = parseResponse(response);
                        if (parsedResponse.id === id){
                            if (parsedResponse.session_state)
                                window.location.reload();

                            $scope.tagTypes = parsedResponse.result;
                        }
                    };

                    //insert a tag
                    $scope.addTag = function (form) {
                        form.$submitted = true;

                        if (form.$valid) {
                            let id1 = ++requestId;
                            socket.send(encodeRequestWithId(id1, 'insert_tag', {
                                name: $scope.insertTag.name,
                                type: $scope.insertTag.type,
                                macs: macs
                            }));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id1) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result.length === 0) {
                                        $scope.insertTag.resultClass = 'background-green';
                                        $timeout(function () {
                                            $mdDialog.hide();
                                            $rootScope.$emit('updateTagsTable', {});
                                        }, 1000);
                                    }
                                }
                            };
                        } else {
                            $scope.insertTag.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            let registryDialog = {
                locals             : {admin: $scope.isAdmin, userManager: $scope.isUserManager, position: position},
                templateUrl        : componentsPath + 'tags-table.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', 'admin', 'userManager', 'position', function ($scope, admin, userManager, position) {
                    $scope.selected   = [];
                    $scope.tags       = [];
                    $scope.tableEmpty     = false;
                    $scope.tagsOnline = [];
                    $scope.isAdmin = admin;
                    $scope.isHome = position === 'home';
                    $scope.isUserManager = userManager;
                    $scope.selectedType = null;
                    $scope.tagTypes = [];
                    $scope.query      = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    let id3 = ++requestId;
                    let id0 = -1;
                    let updateTagsTable = () => {
                        socket.send(encodeRequestWithId(id3, 'get_all_tags'));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id3) {
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                $scope.tags = parsedResponse.result;
                                ($scope.tags.length === 0)
                                    ? $scope.tableEmpty = true
                                    : $scope.tableEmpty = false;

                                let offgridTagsIndoor  = parsedResponse.result.filter(t => (t.gps_north_degree === 0 && t.gps_east_degree === 0) && (t.type_id !== 1 && t.type_id !== 14) && ((Date.now() - new Date(t.time)) > t.sleep_time_indoor));
                                let offgridTagsOutdoor = parsedResponse.result.filter(t => (t.gps_north_degree !== 0 && t.gps_east_degree !== 0) && ((Date.now() - new Date(t.gps_time)) > t.sleep_time_outdoor));

                                let offTags  = parsedResponse.result.filter(t => (t.gps_north_degree === 0 && t.gps_east_degree === 0) && (t.type_id === 1 || t.type_id === 14) && ((t.is_exit && t.radio_switched_off)));
                                let offTags1 = parsedResponse.result.filter(t => (t.gps_north_degree === 0 && t.gps_east_degree === 0) && (t.type_id === 1 || t.type_id === 14) && ((t.is_exit && !t.radio_switched_off)));

                                let tempOffgrid = [];
                                offgridTagsIndoor.forEach(elem => {
                                    tempOffgrid.push(elem);
                                });

                                offgridTagsOutdoor.forEach(elem => {
                                    tempOffgrid.push(elem);
                                });

                                offTags.forEach(elem => {
                                    tempOffgrid.push(elem);
                                });

                                offTags1.forEach(elem => {
                                    tempOffgrid.push(elem);
                                });

                                $scope.tagsOnline = $scope.tags.filter(t => !tempOffgrid.some(to => to.id === t.id));
                                id0 = ++requestId;
                                socket.send(encodeRequestWithId(id0, 'get_all_types'));
                            } else if (parsedResponse.id === id0){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                $scope.tagTypes = parsedResponse.result;
                            }
                        };
                    };

                    updateTagsTable();

                    $rootScope.$on('updateTagsTable', function () {
                        updateTagsTable();
                    });

                    $scope.updateTagType = (tag, selectedType) => {
                        if (tag.type_id.toString() !== selectedType.toString()) {
                            let id = ++requestId;
                            socket.send(encodeRequestWithId(id, 'update_tag_type', {
                                tag : tag.id,
                                type: selectedType
                            }));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    console.log('tag updated');
                                }
                            };
                        }
                    };

                    $scope.tagsContainTag = (tags, tag) => {
                        return tags.some(t => t.id === tag.id);
                    };

                    $scope.editCell = (event, tag, tagName) => {

                        event.stopPropagation();

                        if (admin || userManager) {
                            let editCell = {
                                modelValue : tag[tagName],
                                save       : function (input) {
                                    input.$invalid = true;
                                    tag[tagName]   = input.$modelValue;
                                    let id4 = ++requestId;
                                    socket.send(encodeRequestWithId(id4, 'change_tag_field', {
                                        tag_id     : tag.id,
                                        tag_field  : tagName,
                                        field_value: input.$modelValue
                                    }));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse.id === id4){
                                            if (parsedResponse.session_state)
                                                window.location.reload();

                                            if (parsedResponse.result !== 1) {
                                                console.log(parsedResponse.result);
                                                //TODO handle if the field is not saved
                                            }
                                        }
                                    };
                                },
                                targetEvent: event,
                                title      : lang.insertValue,
                                validators : {
                                    'md-maxlength': 30
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //deleting tag
                    $scope.deleteRow = (tag) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteTag.toUpperCase())
                            .textContent(lang.okDeleteTag)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteTag.toUpperCase())
                            .cancel(lang.cancel.toUpperCase());

                        $mdDialog.show(confirm).then(() => {
                            let id5 = ++requestId;
                            socket.send(encodeRequestWithId(id5, 'delete_tag', {tag_id: tag.id}));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id5){
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result.length === 0) {
                                        $scope.tags = $scope.tags.filter(t => t.id !== tag.id);
                                        $scope.$apply();
                                    }
                                }
                            };
                        }, function () {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //inserting tag
                    $scope.addNewRow = () => {
                        $mdDialog.show(addRowDialog);
                    };

                    //handeling tag macs
                    $scope.tagMacs = (tag) => {
                        $scope.clickedTag = tag;
                        let tagMacsDialog = {
                            locals             : {tag: tag},
                            templateUrl        : componentsPath + 'insert-tag-mac.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            multiple: true,
                            controller         : ['$scope', 'tag', function ($scope, tag) {

                                $scope.macs = [];
                                $scope.tag  = tag;

                                $scope.query = {
                                    limitOptions: [5, 10, 15],
                                    order       : 'name',
                                    limit       : 5,
                                    page        : 1
                                };

                                let id6 = ++requestId;
                                socket.send(encodeRequestWithId(id6, 'get_tag_macs', {tag: tag.id}));
                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    if (parsedResponse.id === id6){
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        $scope.macs = parsedResponse.result;
                                    }
                                };

                                //deleting a mac
                                $scope.deleteMac = (event, mac) => {
                                    let confirm = $mdDialog.confirm()
                                        .title(lang.deleteMac.toUpperCase())
                                        .textContent(lang.okDeleteMac)
                                        .targetEvent(event)
                                        .multiple(true)
                                        .ok(lang.deleteMac.toUpperCase())
                                        .cancel(lang.cancel.toUpperCase());

                                    $mdDialog.show(confirm).then(function () {
                                        let id7 = ++requestId;
                                        socket.send(encodeRequestWithId(id7, 'delete_mac', {mac_id: mac.id}));
                                        socket.onmessage = (response) => {
                                            let parsedResponse = parseResponse(response);
                                            if (parsedResponse.id === id7){
                                                if (parsedResponse.session_state)
                                                    window.location.reload();

                                                if (parsedResponse.result !== 0) {
                                                    $scope.macs = $scope.macs.filter(m => m.id !== mac.id);
                                                    $scope.$apply();
                                                }
                                            }
                                        }
                                    }, function () {
                                        console.log('CANCELLATO!!!!');
                                    });
                                };

                                //inserting a mac
                                $scope.addNewMac = () => {
                                    $mdDialog.show({
                                        locals             : {tag: tag},
                                        templateUrl        : componentsPath + 'insert-mac-row.html',
                                        parent             : angular.element(document.body),
                                        targetEvent        : event,
                                        clickOutsideToClose: true,
                                        multiple           : true,
                                        controller         : ['$scope', function ($scope) {

                                            $scope.insertMac = {
                                                name       : '',
                                                type       : '',
                                                resultClass: ''
                                            };

                                            $scope.addMac = (form) => {
                                                form.$submitted = true;

                                                if (form.$valid) {
                                                    let id8 = ++requestId;
                                                    socket.send(encodeRequestWithId(id8, 'insert_mac', {
                                                        name  : $scope.insertMac.name,
                                                        type  : $scope.insertMac.type,
                                                        tag_id: tag.id
                                                    }));
                                                    socket.onmessage = (response) => {
                                                        let parsedResponse = parseResponse(response);
                                                        if (parsedResponse.id === id8){
                                                            if (parsedResponse.session_state)
                                                                window.location.reload();

                                                            if (parsedResponse.result !== 0) {
                                                                $scope.insertMac.resultClass = 'background-green';
                                                                $timeout(function () {
                                                                    $mdDialog.hide();
                                                                    $mdDialog.hide(tagMacsDialog);
                                                                    $mdDialog.show(tagMacsDialog);
                                                                }, 1000);
                                                                $scope.$apply();
                                                            } else {
                                                                $scope.insertTag.resultClass = 'background-red';
                                                            }
                                                        }
                                                    };
                                                } else {
                                                    $scope.insertTag.resultClass = 'background-red';
                                                }
                                            };

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    });
                                };

                                $scope.editCell = (event, mac, macName) => {

                                    event.stopPropagation();

                                    if (admin) {
                                        let editCell = {
                                            modelValue : mac[macName],
                                            save       : function (input) {
                                                input.$invalid = true;
                                                mac[macName]   = input.$modelValue;
                                                let id9 = ++requestId;
                                                socket.send(encodeRequestWithId(id9, 'change_mac_field', {
                                                    mac_id     : mac.id,
                                                    mac_field  : macName,
                                                    field_value: input.$modelValue
                                                }));
                                                socket.onmessage = (response) => {
                                                    let parsedResponse = parseResponse(response);
                                                    if (parsedResponse.id === id9){
                                                        if (parsedResponse.session_state)
                                                            window.location.reload();

                                                        if (parsedResponse.result !== 1) {
                                                            console.log(parsedResponse.result);
                                                            //TODO handle the case in witch the field is not changed
                                                        }
                                                    }
                                                };
                                            },
                                            targetEvent: event,
                                            title      : lang.insertValue,
                                            validators : {
                                                'md-maxlength': 30
                                            }
                                        };

                                        $mdEditDialog.large(editCell);
                                    }
                                };

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        };

                        $mdDialog.show(tagMacsDialog);
                    };

                    $scope.tagZones = (tag) => {
                        let tagZonesDialog = {
                            locals             : {tag: tag},
                            templateUrl        : componentsPath + 'manage-zones.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            multiple           : true,
                            controller         : ['$scope', 'tag', function ($scope, tag) {

                                $scope.zones = [];
                                $scope.tableEmpty = false;

                                $scope.query = {
                                    limitOptions: [5, 10, 15],
                                    order       : 'name',
                                    limit       : 5,
                                    page        : 1
                                };

                                let id2 = ++requestId;
                                socket.send(encodeRequestWithId(id2, 'get_forbidden_zones', {
                                    tag_id: tag.id
                                }));

                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    console.log(parsedResponse);
                                    if (parsedResponse.id === id2 ){
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        $scope.tableEmpty = parsedResponse.result.length === 0;
                                        $scope.zones = parsedResponse.result;
                                    }
                                };


                                //inserting a mac
                                $scope.manageNewZone = () => {
                                    $mdDialog.hide();
                                    $mdDialog.show({
                                        locals             : {tag: tag, zones: $scope.zones},
                                        templateUrl        : componentsPath + 'insert-managed-zones.html',
                                        parent             : angular.element(document.body),
                                        targetEvent        : event,
                                        clickOutsideToClose: true,
                                        multiple           : true,
                                        controller         : ['$scope', 'tag', 'zones', function ($scope, tag, zones) {


                                            let zonesIds = [];

                                            $scope.insertManagedZones = {
                                                resultClass: '',
                                                selectedZones: [],
                                                allZones: []
                                            };
                                            let id3 = -1, id4 = -1;


                                            if (dataService.location.is_inside === 0){
                                                id3 = ++requestId;
                                                socket.send(encodeRequestWithId(id3, 'get_outdoor_zones', {
                                                    location: dataService.location.name,
                                                }));
                                            } else {
                                                id4 = ++requestId;
                                                socket.send(encodeRequestWithId(id4, 'get_floor_zones', {
                                                    floor: dataService.defaultFloorName,
                                                    location: dataService.location.name,
                                                    user: dataService.user.username
                                                }));
                                            }
                                            socket.onmessage = (response) => {
                                                let parsedResponse = parseResponse(response);
                                                if (parsedResponse.id === id3){
                                                    if (parsedResponse.session_state)
                                                        window.location.reload();

                                                    $scope.insertManagedZones.allZones = parsedResponse.result.filter(z => !zones.some(zs => z.id === zs.zone_id));
                                                } else if (parsedResponse.id === id4){
                                                    if (parsedResponse.session_state)
                                                        window.location.reload();

                                                    $scope.insertManagedZones.allZones = parsedResponse.result.filter(z => !zones.some(zs => z.id === zs.zone_id));
                                                }
                                            };

                                            $scope.addManagedZones = (form) => {
                                                form.$submitted = true;

                                                if (form.$valid) {

                                                    $scope.insertManagedZones.allZones.filter(z => $scope.insertManagedZones.selectedZones.some(sz => sz === z.name))
                                                        .forEach((zone) => {
                                                            zonesIds.push(zone.id);
                                                        });

                                                    let id4 = ++requestId;
                                                    socket.send(encodeRequestWithId(id4, 'insert_managed_zones', {
                                                        tag_id  : tag.id,
                                                        zones  : zonesIds,
                                                    }));
                                                    socket.onmessage = (response) => {
                                                        let parsedResponse = parseResponse(response);
                                                        if (parsedResponse.id === id4){
                                                            if (parsedResponse.session_state)
                                                                window.location.reload();

                                                            $mdDialog.hide();
                                                            $mdDialog.show(tagZonesDialog);
                                                        }
                                                    };
                                                } else {
                                                    $scope.insertManagedZones.resultClass = 'background-red';
                                                }
                                            };

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    });
                                };

                                //deleting tag
                                $scope.deleteManagedZone = (zone) => {
                                    console.log(zone);
                                    let confirm = $mdDialog.confirm()
                                        .title(lang.deleteZone.toUpperCase())
                                        .textContent(lang.deleteZoneText)
                                        .targetEvent(event)
                                        .multiple(true)
                                        .ok(lang.deleteZone)
                                        .cancel(lang.cancel);

                                    $mdDialog.show(confirm).then(() => {
                                        let id5 = ++requestId;
                                        socket.send(encodeRequestWithId(id5, 'delete_managed_zone', {
                                            tag_id: tag.id,
                                            zone_id: zone.zone_id
                                        }));
                                        socket.onmessage = (response) => {
                                            let parsedResponse = parseResponse(response);
                                            if (parsedResponse.id === id5){
                                                if (parsedResponse.session_state)
                                                    window.location.reload();

                                                if (parsedResponse.result === 1) {
                                                    $scope.zones = $scope.zones.filter(z => z.zone_id !== zone.zone_id);
                                                    $scope.$apply();
                                                    console.log($scope.zones);
                                                }
                                            }
                                        };
                                    }, function () {
                                        console.log('CANCELLATO!!!!');
                                    });
                                };

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        };

                        $mdDialog.show(tagZonesDialog);
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function (event, removePromise) {
                    if (dataService.homeTimer === undefined && position === 'home'){
                        NgMap.getMap('main-map').then((map) => {
                            $rootScope.$emit('constantUpdateNotifications', map)
                        });
                    }
                    if (dataService.canvasInterval === undefined && position === 'canvas'){
                        $rootScope.$emit('constantUpdateCanvas', {})
                    }
                    if (dataService.updateMapTimer === undefined && position === 'outdoor'){
                        NgMap.getMap('outdoor-map').then((map) => {
                            $rootScope.$emit('constantUpdateMapTags', map)
                        });
                    }
                }
            };

            $mdDialog.show(registryDialog);
        };

        $scope.zone = () => {
            $interval.cancel(dataService.canvasInterval);
            dataService.canvasInterval = undefined;

            let floor = dataService.userFloors.filter(f => f.name === dataService.defaultFloorName)[0];

            let addRowDialog = {
                templateUrl        : componentsPath + 'insert-zones-row.html',
                parent             : angular.element(document.body),
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', function ($scope) {

                    $scope.insertZone = {
                        zoneName       : '',
                        x_left     : '',
                        x_right    : '',
                        y_up       : '',
                        y_down     : '',
                        color: '',
                        resultClass: '',
                    };

                    //insert a zone
                    $scope.insertZone = function (form) {
                        console.log('insert zone called');
                        form.$submitted = true;

                        if (form.$valid) {
                            let data = {
                                name   : $scope.insertZone.zoneName,
                                x_left : $scope.insertZone.x_left,
                                x_right: $scope.insertZone.x_right,
                                y_up   : $scope.insertZone.y_up,
                                y_down : $scope.insertZone.y_down,
                                color: ($scope.insertZone.color !== undefined) ? $scope.insertZone.color : '#FF0000',
                                floor  : floor.id
                            };

                            console.log(data);
                            let strigified = JSON.stringify(data);
                            let id = ++requestId;
                            socket.send(encodeRequestWithId(id, 'insert_floor_zone', {data: strigified}));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result !== 0) {
                                        $scope.insertZone.resultClass = 'background-green';
                                        $timeout(function () {
                                            $mdDialog.hide(addRowDialog);
                                            $rootScope.$emit('updateZoneTable', {});
                                        }, 1000);
                                        $scope.$apply();
                                    }
                                }
                            };
                        } else {
                            $scope.insertZone.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            let zoneDialog = {
                locals             : {admin: $scope.isAdmin},
                templateUrl        : componentsPath + 'zone-table.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected = [];
                    $scope.isAdmin = dataService.isAdmin;
                    $scope.isOutdoor = false;
                    $scope.tableEmptyZone = false;
                    $scope.isUserManager = dataService.isUserManager;

                    $scope.zones    = [];
                    $scope.query    = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    $scope.changeColor = (zoneId, zoneColor) => {
                        console.log(zoneId);
                        console.log(zoneColor);
                        let id1 = ++requestId;
                        socket.send(encodeRequestWithId(id1, 'update_zone_color', {
                            zone_id   : zoneId,
                            zone_color: zoneColor,
                        }));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id1) {
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                console.log(parsedResponse.result);
                            }
                        }
                    };

                    let updateZoneTable = () => {
                        let id1 = ++requestId;
                        socket.send(encodeRequestWithId(id1, 'get_floor_zones', {
                            floor   : floor.name,
                            location: dataService.location.name,
                            user    : dataService.user.username
                        }));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id1) {
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                $scope.zones = parsedResponse.result;
                                $scope.tableEmptyZone = parsedResponse.result.length === 0;
                                $scope.$apply();
                            }
                        };
                    };

                    updateZoneTable();

                    $rootScope.$on('updateZoneTable', function () {
                        updateZoneTable();
                    });

                    $scope.editCell = (event, zone, zoneName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue : zone[zoneName],
                                save       : function (input) {
                                    input.$invalid = true;
                                    zone[zoneName] = input.$modelValue;
                                    let id2 = ++requestId;
                                    socket.send(encodeRequestWithId(id2, 'change_zone_field', {
                                        zone_id     : zone.id,
                                        zone_field  : zoneName,
                                        field_value: input.$modelValue
                                    }));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse === id2) {
                                            if (parsedResponse.session_state)
                                                window.location.reload();

                                            if (response.result !== 1)
                                                console.log(response.result);
                                        }
                                    };
                                },
                                targetEvent: event,
                                title      : lang.insertValue,
                                validators : {
                                    'md-maxlength': 30
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //deleting zone
                    $scope.deleteRow = (zone) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteZone)
                            .textContent(lang.okDeleteZone)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteZone)
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(() => {
                            let id3 = ++requestId;
                            socket.send(encodeRequestWithId(id3, 'delete_floor_zone', {
                                zone_id: zone.id
                            }));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id3){
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    $scope.zones = $scope.zones.filter(z => z.id !== zone.id);
                                    $scope.$apply();
                                }
                            };
                        }, function () {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //inserting tag
                    $scope.addNewRow = () => {
                        $mdDialog.show(addRowDialog);
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function (event, removePromise) {
                    if (dataService.canvasInterval === undefined) {
                        $rootScope.$emit('constantUpdateCanvas', {})
                    }
                }
            };

            $mdDialog.show(zoneDialog);
        };

        $scope.zoneOutdoor = () => {
            $interval.cancel(dataService.updateMapTimer);
            dataService.updateMapTimer = undefined;
            let zoneColorModified = false;

            let addRectRowDialog = {
                templateUrl        : componentsPath + 'insert-zones-row.html',
                parent             : angular.element(document.body),
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', function ($scope) {
                    $scope.insertZone = {
                        zoneName       : '',
                        x_left     : '',
                        x_right    : '',
                        y_up       : '',
                        y_down     : '',
                        color: '',
                        resultClass: '',
                    };

                    //insert a zone
                    $scope.insertZone = function (form) {
                        console.log('insert zone called');
                        form.$submitted = true;
                        console.log($scope.insertZone.color);

                        if (form.$valid) {
                            let data = {
                                name   : $scope.insertZone.zoneName,
                                x_left : $scope.insertZone.x_left,
                                x_right: $scope.insertZone.x_right,
                                y_up   : $scope.insertZone.y_up,
                                y_down : $scope.insertZone.y_down,
                                color: ($scope.insertZone.color !== undefined) ? $scope.insertZone.color : '#FF0000',
                                location  : dataService.location.name
                            };

                            let strigified = JSON.stringify(data);
                            let id = ++requestId;
                            socket.send(encodeRequestWithId(id, 'insert_outdoor_rect_zone', {data: strigified}));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result !== 0) {
                                        NgMap.getMap('outdoor-map').then((map) => {
                                            console.log('enabling timer: ', map);
                                            $rootScope.$emit('constantUpdateMapTags', map, zoneColorModified)
                                            console.log('square zone inserted');
                                            dataService.outdoorZones.push({id: parsedResponse.result, zone: new google.maps.Rectangle({
                                                    strokeColor: $scope.insertZone.color,
                                                    strokeOpacity: 0.8,
                                                    strokeWeight: 2,
                                                    fillColor: $scope.insertZone.color,
                                                    fillOpacity: 0.35,
                                                    map: map,
                                                    bounds: {
                                                        north: parseFloat($scope.insertZone.x_leftt),
                                                        south: parseFloat($scope.insertZone.x_right),
                                                        east: parseFloat($scope.insertZone.y_up),
                                                        west: parseFloat($scope.insertZone.y_down)
                                                    }
                                                })});
                                        });

                                        console.log('zone inserted: ', dataService.outdoorZones);
                                        $scope.insertZone.resultClass = 'background-green';
                                        $timeout(function () {
                                            $mdDialog.hide(addRectRowDialog);
                                            $rootScope.$emit('updateZoneOutdoorTable', {});
                                        }, 1000);
                                        $scope.$apply();
                                    }
                                }
                            };
                        } else {
                            $scope.insertZone.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            let addRoundRowDialog = {
                templateUrl        : componentsPath + 'insert-outdoor-zones-row.html',
                parent             : angular.element(document.body),
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', function ($scope) {
                    $scope.insertZone = {
                        zoneName       : '',
                        gpsNorth     : '',
                        gpsEast    : '',
                        radius       : '',
                        color: '',
                        resultClass: '',
                    };

                    //insert a zone
                    $scope.insertZone = function (form) {
                        console.log('insert zone called');
                        form.$submitted = true;
                        console.log($scope.insertZone.color);

                        if (form.$valid) {
                            let data = {
                                name   : $scope.insertZone.zoneName,
                                x : $scope.insertZone.gpsNorth,
                                y: $scope.insertZone.gpsEast,
                                radius   : $scope.insertZone.radius,
                                color: ($scope.insertZone.color !== undefined) ? $scope.insertZone.color : '#FF0000',
                                location  : dataService.location.name
                            };

                            let strigified = JSON.stringify(data);
                            let id1 = ++requestId;
                            socket.send(encodeRequestWithId(id1, 'insert_outdoor_round_zone', {data: strigified}));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id1) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result !== 0) {
                                        NgMap.getMap('outdoor-map').then((map) => {
                                            console.log('enabling timer: ', map);
                                            $rootScope.$emit('constantUpdateMapTags', map, zoneColorModified);
                                            dataService.outdoorZones.push({id: parsedResponse.result, zone: new google.maps.Circle({
                                                    strokeColor  : $scope.insertZone.color,
                                                    strokeOpacity: 0.8,
                                                    strokeWeight : 2,
                                                    fillColor    : $scope.insertZone.color,
                                                    fillOpacity  : 0.35,
                                                    map          : map,
                                                    center: {lat: parseFloat($scope.insertZone.gpsNorth), lng: parseFloat($scope.insertZone.gpsEast)},
                                                    radius: $scope.insertZone.radius / 111000
                                                })});
                                        });

                                        console.log('zone inserted: ', dataService.outdoorZones);
                                        $scope.insertZone.resultClass = 'background-green';
                                        $timeout(function () {
                                            $mdDialog.hide(addRoundRowDialog);
                                            $rootScope.$emit('updateZoneOutdoorTable', {});
                                        }, 1000);
                                        $scope.$apply();
                                    }
                                }
                            };
                        } else {
                            $scope.insertZone.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            let zoneDialog = {
                locals             : {admin: $scope.isAdmin},
                templateUrl        : componentsPath + 'zone-table.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected = [];
                    $scope.isAdmin = dataService.isAdmin;
                    $scope.isOutdoor = true;
                    $scope.tableEmptyZone = false;
                    $scope.isUserManager = dataService.isUserManager;

                    $scope.zones    = [];
                    $scope.query    = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    $scope.changeColor = (zoneId, zoneColor) => {
                        console.log(zoneId);
                        console.log(zoneColor);
                        let id1 = ++requestId;
                        socket.send(encodeRequestWithId(id1, 'update_zone_color', {
                            zone_id   : zoneId,
                            zone_color: zoneColor,
                        }));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id1) {
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                console.log(parsedResponse.result);
                                dataService.outdoorZones.forEach(zone => {
                                    if (zone.id === zoneId){
                                        zone.zone.setOptions({fillColor: zoneColor, strokeColor: zoneColor});
                                        zoneColorModified = true;
                                    }
                                });
                            }
                        }
                    };

                    let updateZoneOutdoorTable = () => {
                        let id1 = ++requestId;
                        socket.send(encodeRequestWithId(id1, 'get_outdoor_zones', {
                            location: dataService.location.name,
                        }));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id1) {
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                $scope.zones = parsedResponse.result;
                                $scope.tableEmptyZone = parsedResponse.result.length === 0;
                                $scope.$apply();
                            }
                        };
                    };

                    updateZoneOutdoorTable();

                    $rootScope.$on('updateZoneOutdoorTable', function () {
                        updateZoneOutdoorTable();
                    });

                    $scope.editCell = (event, zone, zoneName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue : zone[zoneName],
                                save       : function (input) {
                                    input.$invalid = true;
                                    zone[zoneName] = input.$modelValue;
                                    let id2 = ++requestId;
                                    socket.send(encodeRequestWithId(id2, 'change_zone_field', {
                                        zone_id     : zone.id,
                                        zone_field  : zoneName,
                                        field_value: input.$modelValue
                                    }));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse === id2) {
                                            if (parsedResponse.session_state)
                                                window.location.reload();

                                            if (response.result !== 1) {
                                                console.log(response.result);
                                            }
                                        }
                                    };
                                },
                                targetEvent: event,
                                title      : lang.insertValue,
                                validators : {
                                    'md-maxlength': 30
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //deleting zone
                    $scope.deleteRow = (zone) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteZone)
                            .textContent(lang.okDeleteZone)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteZone)
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(() => {
                            let id3 = ++requestId;
                            socket.send(encodeRequestWithId(id3, 'delete_floor_zone', {
                                zone_id: zone.id
                            }));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id3){
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    $scope.zones = $scope.zones.filter(z => z.id !== zone.id);
                                    let deletedZone = dataService.outdoorZones.filter(z => z.id === zone.id)[0];
                                    deletedZone.zone.setMap(null);
                                    dataService.outdoorZones = dataService.outdoorZones.filter(z => z.id !== zone.id);
                                    $scope.$apply();
                                }
                            };
                        }, function () {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //inserting tag
                    $scope.addNewRectRow = () => {
                        $mdDialog.show(addRectRowDialog);
                    };

                    $scope.addNewRoundRow = () => {
                        $mdDialog.show(addRoundRowDialog);
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function (event, removePromise) {
                    if (dataService.updateMapTimer === undefined){
                        window.location.reload();
                        // NgMap.getMap('outdoor-map').then((map) => {
                        //     console.log('enabling timer: ', map);
                        //     $rootScope.$emit('constantUpdateMapTags', map, zoneColorModified)
                        // });
                    }
                }
            };

            $mdDialog.show(zoneDialog);
        };

        //showing the anchors table
        $scope.showAnchorsTable = function () {
            if (dataService.canvasInterval !== undefined) {
                $interval.cancel(dataService.canvasInterval);
                dataService.canvasInterval = undefined;
            }

            let floor = dataService.userFloors.filter(f => f.name === dataService.defaultFloorName)[0];

            let addRowDialog = {
                templateUrl        : componentsPath + 'insert-anchor-row.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', function ($scope) {

                    $scope.insertAnchor = {
                        name        : '',
                        mac         : '',
                        selectedType: '',
                        ip          : '',
                        rssi        : '',
                        proximity   : '',
                        selectedNeighbors: [],
                        selectedPermitteds: [],
                    };

                    $scope.permitteds = dataService.allTags;
                    $scope.tableEmpty     = false;
                    $scope.searchString       = '';
                    $scope.anchorTypes        = [];

                    let id = ++requestId;
                    let id1, id2 = -1;

                    socket.send(encodeRequestWithId(id, 'get_anchors_by_floor_and_location', {
                        floor   : floor.name,
                        location: dataService.location.name
                    }));
                    socket.onmessage = (response) => {
                        let parsedResponse = parseResponse(response);
                        if (parsedResponse.id === id){
                            if (parsedResponse.session_state)
                                window.location.reload();

                            $scope.neighbors = parsedResponse.result;
                            id1 = ++requestId;
                            socket.send(encodeRequestWithId(id1, 'get_anchor_types'));
                        } else if (parsedResponse.id === id1){
                            if (parsedResponse.session_state)
                                window.location.reload();

                            $scope.anchorTypes = parsedResponse.result;

                        }
                    };

                    $scope.updateSearch = (event) => {
                        event.stopPropagation();
                    };

                    //inserting an anchor
                    $scope.addAnchor = (form) => {
                        form.$submitted = true;

                        if (form.$valid) {
                            let neighborsString = '';
                            let permittedIds    = [];
                            $scope.neighbors.filter(a => $scope.insertAnchor.selectedNeighbors.some(sa => sa === a.name))
                                .forEach((anchor) => {
                                    neighborsString += anchor.mac + ',';
                                });

                            neighborsString = neighborsString.replace(/,\s*$/, "");

                            $scope.permitteds = $scope.permitteds.filter(t => $scope.insertAnchor.selectedPermitteds.some(st => st === t.name))
                                .forEach((t) => {
                                    permittedIds.push(t.id);
                                });


                            let id3 = ++requestId;
                            socket.send(encodeRequestWithId(id3, 'insert_anchor', {
                                name      : $scope.insertAnchor.name,
                                mac       : $scope.insertAnchor.mac,
                                type      : $scope.insertAnchor.selectedType,
                                ip        : $scope.insertAnchor.ip,
                                rssi      : $scope.insertAnchor.rssi,
                                proximity : $scope.insertAnchor.proximity,
                                permitteds: permittedIds,
                                neighbors : neighborsString,
                                floor     : floor.id
                            }));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id3){
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result.length === 0) {
                                        $scope.insertAnchor.resultClass = 'background-green';
                                        $timeout(function () {
                                            $mdDialog.hide();
                                            $rootScope.$emit('updateAnchorsTable', {});
                                        }, 1000);
                                        $scope.$apply();
                                    }
                                }
                            };

                        } else {
                            $scope.insertAnchor.resultClass = 'background-red';
                        }
                    };

                    $scope.clearSearch = () => {
                        $scope.searchString = '';
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            let anchorsDialog = {
                locals             : {admin: $scope.isAdmin},
                templateUrl        : componentsPath + 'anchors-table.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected = [];
                    $scope.isAdmin = dataService.isAdmin;
                    $scope.isUserManager = dataService.isUserManager;
                    $scope.tableEmpty = false;
                    $scope.anchorTable = {
                        permittedAssets: [],
                        selectedPermitteds: [],
                        tags:  dataService.allTags
                    };
                    $scope.anchors = [];

                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    let updateAnchorsTable = () => {
                        console.log('updating table');
                        $scope.anchors = [];
                        let id4 = ++requestId;
                        let id5 = -1;
                        socket.send(encodeRequestWithId(id4, 'get_anchors_by_floor_and_location', {
                            floor   : (floor.name !== undefined) ? floor.name : '',
                            location: dataService.location.name
                        }));

                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id4){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                // $scope.anchors = parsedResponse.result;
                                parsedResponse.result.forEach(anchor => {
                                    let anchorPermitteds = anchor.permitted_asset.split(',');
                                    $scope.anchors.push({anchor: anchor, permitteds: anchorPermitteds[0] === "" ? [] : anchorPermitteds});
                                });

                                $scope.tableEmpty = parsedResponse.result.length === 0;
                                $scope.$apply();

                                id5 = ++requestId;
                                socket.send(encodeRequestWithId(id5, 'get_all_tags_macs'));
                            } else if (parsedResponse.id === id5){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                dataService.allTags.forEach(tag => {
                                    parsedResponse.result.forEach(mac => {
                                        if (mac.tag_name === tag.name){
                                            $scope.anchorTable.permittedAssets.push({tag: tag.name, mac: mac.mac});
                                        }
                                    });
                                });
                            }
                        };
                    };

                    let isPermittedChanged = (anchor, permitteds) => {
                        let selectedAnchor = $scope.anchors.filter(a => a.anchor.id === anchor)[0];
                        if (selectedAnchor.anchor.permitted_asset.length === 0)
                            return true;
                        let anchorPermited = selectedAnchor.anchor.permitted_asset.split(',');
                        let permittedsArray = anchorPermited[0] === "" ? [] : anchorPermited;
                        return !angular.equals(permitteds, permittedsArray);
                    };

                    $scope.updatePermitteds = (anchor, permitteds) => {
                        if (isPermittedChanged(anchor, permitteds)) {
                            console.log('updating anchor: ', anchor);
                            let permittedsString = '';
                            permitteds.forEach(permitted => {
                                permittedsString += permitted + ',';
                            });

                            let id6 = ++requestId;
                            socket.send(encodeRequestWithId(id6, 'update_anchor_permitteds', {
                                anchor_id : anchor,
                                permitteds: permittedsString
                            }));
                            socket.onmessage = (response) => {
                                let persedResponse = parseResponse(response);
                                if (persedResponse.id === id6) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    console.log("permitteds updated");
                                }
                            };
                        }
                    };

                    updateAnchorsTable();

                    $rootScope.$on('updateAnchorsTable', function () {
                        updateAnchorsTable();
                    });

                    $scope.editCell = (event, anchor, anchorName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue : anchor[anchorName],
                                save       : function (input) {
                                    input.$invalid     = true;
                                    anchor[anchorName] = input.$modelValue;
                                    let id5      = ++requestId;
                                    socket.send(encodeRequestWithId(id5, 'change_anchor_field', {
                                        anchor_id   : anchor.id,
                                        anchor_field: anchorName,
                                        field_value : input.$modelValue
                                    }));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse.id === id5) {
                                            if (parsedResponse.session_state)
                                                window.location.reload();

                                            if (parsedResponse.result !== 1)
                                                console.log(parsedResponse.result);
                                        }
                                    };
                                },
                                targetEvent: event,
                                title      : lang.insertValue,
                                validators : {
                                    'md-maxlength': 30
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //inserting an anchor
                    $scope.addNewRow = () => {
                        $mdDialog.show(addRowDialog);
                    };

                    //deleting an anchor
                    $scope.deleteRow = (anchor) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteAnchor.toUpperCase())
                            .textContent(lang.okDeleteAnchor)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteAnchor.toUpperCase())
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(function () {
                            let id6 = ++requestId;
                            socket.send(encodeRequestWithId(id6, 'delete_anchor', {anchor_id: anchor.id}));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id6){
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result > 0) {
                                        $rootScope.$emit('updateAnchorsTable', {});
                                        // $scope.anchors = $scope.anchors.filter(a => a.id !== anchor.id);
                                        // $scope.$apply();
                                    }
                                }
                            };
                        }, function () {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    $scope.hideAnchors = () => {
                        $mdDialog.hide();
                    };
                }],
                onRemoving: function (event, removePromise) {
                    if (dataService.canvasInterval === undefined){
                        $rootScope.$emit('constantUpdateCanvas', {})
                    }
                }
            };
            $mdDialog.show(anchorsDialog);
        };

        //showing floors table
        $scope.floorUpdate = () => {
            $interval.cancel(dataService.canvasInterval);
            dataService.canvasInterval = undefined;
            let floorChanged = false;

            let addRowDialog = {
                templateUrl        : componentsPath + 'insert-floor-row.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', function ($scope) {
                    let fileInput       = null;
                    let currentLocation = null;

                    $scope.insertFloor = {
                        floorName  : '',
                        mapWidth   : '',
                        spacing    : '',
                        showSuccess: false,
                        showError  : false,
                        message    : '',
                        resultClass: ''
                    };

                    //inserting a new floor
                    $scope.insertFloor = (form) => {
                        form.$submitted = true;

                        if (form.$valid) {
                            let file     = null;
                            let fileName = null;

                            if (fileInput != null && fileInput.files.length !== 0) {
                                file     = fileInput.files[0];
                                fileName = file.name;
                            }
                            let id = ++requestId;
                            let id1, id2 = -1;

                            socket.send(encodeRequestWithId(id, 'get_all_locations'));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    currentLocation = parsedResponse.result.filter(l => l.name === dataService.location.name)[0];

                                    if (file !== null) {
                                        id1 = ++requestId;
                                        socket.send(encodeRequestWithId(id1, 'insert_floor', {
                                            name     : $scope.insertFloor.floorName,
                                            map_image: (fileName === null) ? '' : fileName,
                                            map_width: $scope.insertFloor.mapWidth,
                                            spacing  : $scope.insertFloor.spacing,
                                            location : currentLocation.id
                                        }));
                                    } else {
                                        $scope.insertFloor.showSuccess = false;
                                        $scope.insertFloor.showError   = true;
                                        $scope.insertFloor.message     = lang.selectFloorFile;
                                        $scope.insertFloor.resultClass = 'background-red';
                                    }
                                }else if (parsedResponse.id === id1) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result !== undefined && parsedResponse.result !== 0) {
                                        convertImageToBase64(file)
                                            .then((response) => {
                                                id2 = ++requestId;
                                                socket.send(encodeRequestWithId(id2, 'save_floor_image', {
                                                    imageName: fileName,
                                                    image    : response
                                                }));
                                            });
                                    } else {
                                        $scope.insertFloor.showSuccess = false;
                                        $scope.insertFloor.showError   = true;
                                        $scope.insertFloor.message     = lang.impossibleInsertFloor;
                                        $scope.insertFloor.resultClass = 'background-red';
                                    }
                                }else if (parsedResponse.id === id2){
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    if (parsedResponse.result === false) {
                                        $scope.insertFloor.showSuccess = false;
                                        $scope.insertFloor.showError   = true;
                                        $scope.insertFloor.message     = lang.floorInsertedWithoutImage;
                                        $scope.insertFloor.resultClass = 'background-orange';

                                        $scope.$apply();

                                        $timeout(function () {
                                            $mdDialog.hide();
                                            $rootScope.$emit('updateFloorTable', {});
                                        }, 1000);
                                    } else {
                                        $scope.insertFloor.resultClass = 'background-green';
                                        $scope.insertFloor.showSuccess = true;
                                        $scope.insertFloor.showError   = false;
                                        $scope.insertFloor.message     = lang.floorInserted;

                                        $scope.$apply();

                                        $timeout(function () {
                                            $mdDialog.hide();
                                            $rootScope.$emit('updateFloorTable', {});
                                        }, 1000);
                                    }
                                }
                            };
                        } else {
                            $scope.location.resultClass = 'background-red';
                        }
                    };

                    $scope.uploadFloorImage = () => {
                        fileInput = document.getElementById('marker-image');
                        fileInput.click();
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            let floorDialog = {
                locals             : {admin: $scope.isAdmin},
                templateUrl        : componentsPath + 'floor-settings.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected = [];
                    $scope.isAdmin = dataService.isAdmin;
                    $scope.isUserManager = dataService.isUserManager;

                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    let updateFloorTable = () => {
                        let id = ++requestId;
                        socket.send(encodeRequestWithId(id, 'get_floors_by_location', {location: dataService.location.name}));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                $scope.floors = parsedResponse.result;
                                $scope.$apply();
                            }
                        };
                    };

                    updateFloorTable();

                    $rootScope.$on('updateFloorTable', function () {
                        updateFloorTable();
                    });

                    $scope.editCell = (event, floor, floorName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue : floor[floorName],
                                save       : function (input) {
                                    input.$invalid   = true;
                                    floor[floorName] = input.$modelValue;
                                    let id1 = ++requestId;
                                    socket.send(encodeRequestWithId(id1, 'change_floor_field', {
                                        floor_id   : floor.id,
                                        floor_field: floorName,
                                        field_value: input.$modelValue
                                    }));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse.id === id1){
                                            if (parsedResponse.session_state)
                                                window.location.reload();

                                            if (parsedResponse.result === 1) {
                                                if (floorName === 'map_width')
                                                    floorChanged = true;
                                                updateFloorTable();
                                                //TODO handre when not saving field
                                            }
                                        }
                                    };
                                },
                                targetEvent: event,
                                title      : lang.insertValue,
                                validators : {
                                    'md-maxlength': 30
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //inserting a new floor
                    $scope.addNewRow = () => {
                        $mdDialog.show(addRowDialog);
                    };

                    //deleting a floor
                    $scope.deleteRow = (floor) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteFloor.toUpperCase())
                            .textContent(lang.okDeleteFloor)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteFloor.toUpperCase())
                            .cancel(lang.cancel.toUpperCase());

                        $mdDialog.show(confirm).then(function () {
                            let id = ++requestId;
                            if ($scope.floors.length > 1) {
                                socket.send(encodeRequestWithId(id, 'delete_floor', {floor_id: floor.id}));
                                socket.onmessage = (response) => {
                                    let parsedResponse = parseResponse(response);
                                    if (parsedResponse.id === id){
                                        if (parsedResponse.session_state)
                                            window.location.reload();

                                        if (parsedResponse.result > 0) {
                                            $scope.floors = $scope.floors.filter(a => a.id !== floor.id);
                                            if (floor.name === 'Piano di default')
                                                dataService.defaultFloorCanceled = true;
                                            $scope.$apply();
                                        }
                                    }
                                };
                            }
                        }, function () {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    $scope.uploadFloorImage = (id) => {

                        let fileInput = document.getElementById('floor-image-' + id);

                        $scope.floorId = id;
                        fileInput.click();
                    };

                    $scope.fileNameChanged = () => {
                        let fileInput = document.getElementById('floor-image-' + $scope.floorId);
                        let file      = null;
                        let fileName  = null;

                        if (fileInput != null && fileInput.files.length !== 0) {
                            file     = fileInput.files[0];
                            fileName = file.name;
                        }

                        if (file != null) {
                            convertImageToBase64(file)
                                .then((result) => {
                                    let id = ++requestId;
                                    socket.send(encodeRequestWithId(id, 'save_floor_image', {
                                        id   : $scope.floorId,
                                        image: result,
                                        name : fileName
                                    }));
                                    socket.onmessage = (response) => {
                                        let parsedResponse = parseResponse(response);
                                        if (parsedResponse.id === id){
                                            if (parsedResponse.session_state)
                                                window.location.reload();

                                            //TODO handle if the image is not saved
                                        }
                                    }
                                })
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function (event, removePromise) {
                    if (dataService.canvasInterval === undefined){
                        if (dataService.defaultFloorCanceled) {
                            window.location.reload();
                        }else if (floorChanged){
                            window.location.reload();
                        }else {
                            $rootScope.$emit('constantUpdateCanvas', {})
                        }
                    }
                }
            };

            $mdDialog.show(floorDialog);
        };

        $scope.quickActions = () => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'quick-actions-dialog.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                controller         : ['$scope', '$interval', 'dataService', function ($scope, $interval, dataService) {

                    $scope.isAdmin = dataService.isAdmin;

                    $scope.switch = {
                        showGrid   : dataService.switch.showGrid,
                        showAnchors: dataService.switch.showAnchors,
                        showCameras: dataService.switch.showCameras,
                        showZones: dataService.switch.showZones,
                        showOutrangeTags: dataService.switch.showOutrangeTags,
                        showOutdoorTags: dataService.switch.showOutdoorTags,
                        playAudio  : dataService.switch.playAudio
                    };


                    $scope.updateUserSettings = () => {
                        dataService.updateUserSettings();
                        $mdDialog.hide();
                    };

                    $scope.$watchGroup(['switch.showGrid', "switch.showAnchors", 'switch.showCameras', 'switch.playAudio', 'switch.showOutrangeTags', 'switch.showOutdoorTags', 'switch.showZones'], function (newValues) {
                        dataService.switch.showGrid    = (newValues[0]);
                        dataService.switch.showAnchors = (newValues[1]);
                        dataService.switch.showCameras = (newValues[2]);
                        dataService.switch.playAudio   = (newValues[3]);
                        dataService.switch.showOutrangeTags = (newValues[4]);
                        dataService.switch.showOutdoorTags = (newValues[5]);
                        dataService.switch.showZones = (newValues[6]);
                    })
                }]
            });
        };

        //function that makes the logout of the user
        $scope.logout = () => {
            if (dataService.canvasInterval !== undefined){
                $interval.cancel(dataService.canvasInterval);
                dataService.canvasInterval = undefined;
            }
            if (dataService.homeTimer !== undefined){
                $interval.cancel(dataService.homeTimer);
                dataService.homeTimer = undefined;
            }
            let id = ++requestId;
            socket.send(encodeRequestWithId(id, 'logout'));
            socket.onmessage = (response) => {
                let parsedRespone = parseResponse(response);
                if (parsedRespone.id === id){
                    if (parsedResponse.session_state)
                        window.location.reload();

                    if (parsedRespone.result === 'logged_out')
                        $state.go('login');
                }
            };
        };

        //handeling search tags functionality
        $scope.$watch('selectedLocation', function (newValue) {
            let latlng = new google.maps.LatLng(newValue.latitude, newValue.longitude);
            if (dataService.homeMap !== null) {
                dataService.homeMap.setCenter(latlng);
                dataService.homeMap.setZoom(15);
            }
        });

        //handeling search tags functionality
        $scope.$watch('selectedTag', function (newValue) {
            let newStringValue = "" + newValue;
            if (newStringValue !== '') {

                let newTag = $filter('filter')(dataService.allTags, newValue)[0];
                if (!dataService.isOutdoor(newTag)) {
                    let id1 = ++requestId;
                    socket.send(encodeRequestWithId(id1, 'get_tag_floor', {tag: newTag.id}));
                    socket.onmessage = (response) => {
                        let parsedResponse = parseResponse(response);
                        if (parsedResponse.id === id1) {
                            if (parsedResponse.session_state)
                                window.location.reload();

                            if (parsedResponse.result.location_name === undefined || parsedResponse.result.name === undefined) {
                                $mdDialog.show({
                                    templateUrl        : componentsPath + 'tag-not-found-alert.html',
                                    parent             : angular.element(document.body),
                                    targetEvent        : event,
                                    clickOutsideToClose: true,
                                    controller         : ['$scope', '$controller', ($scope, $controller) => {
                                        $controller('languageController', {$scope: $scope});

                                        $scope.title   = $scope.lang.tagNotFound.toUpperCase();
                                        $scope.message = $scope.lang.tagNotInitialized;


                                        $scope.hide = () => {
                                            $mdDialog.hide();
                                        }
                                    }],


                                    onRemoving: function () {
                                        $scope.selectedTag = '';
                                    },
                                })
                            } else {
                                $mdDialog.show({
                                    locals             : {tags: parsedResponse.result, outerScope: $scope},
                                    templateUrl        : componentsPath + 'search-tag-inside.html',
                                    parent             : angular.element(document.body),
                                    targetEvent        : event,
                                    clickOutsideToClose: true,
                                    controller         : ['$scope', 'tags', 'outerScope', 'socketService', function ($scope, tags, outerScope, socketService) {
                                        let canvas  = null;
                                        let context = null;

                                        $scope.floorData = {
                                            location : '',
                                            floorName: ''
                                        };

                                        $timeout(function () {
                                            canvas  = document.querySelector('#search-canvas-id');
                                            context = canvas.getContext('2d');

                                            $scope.floorData.location  = parsedResponse.result.location_name;
                                            $scope.floorData.floorName = parsedResponse.result.name;

                                            let img = new Image();

                                            img.onload = function () {
                                                canvas.width  = this.naturalWidth;
                                                canvas.height = this.naturalHeight;

                                                //updating the canvas and drawing border
                                                updateCanvas(canvas.width, canvas.height, context, img);

                                                let tagImg = new Image();
                                                tagImg.src = imagePath + 'icons/tags/online_tag_24.png';

                                                tagImg.onload = function () {
                                                    drawIcon(newTag, context, tagImg, parsedResponse.result.width, canvas.width, canvas.height, true);
                                                }
                                            };
                                            img.src    = imagePath + 'floors/' + parsedResponse.result.image_map;
                                        }, 0);

                                        $scope.hide = () => {
                                            outerScope.selectedTag = '';
                                            $mdDialog.hide();
                                        }
                                    }],
                                    onRemoving         : () => {
                                        $scope.selectedTag = '';
                                    }
                                })
                            }
                        }
                    }
                } else {
                    $mdDialog.show({
                        locals             : {tagName: newValue, outerScope: $scope},
                        templateUrl        : componentsPath + 'search-tag-outside.html',
                        parent             : angular.element(document.body),
                        targetEvent        : event,
                        clickOutsideToClose: true,
                        controller         : ['$scope', 'NgMap', 'tagName', 'outerScope', 'socketService', function ($scope, NgMap, tagName, outerScope, socketService) {

                            let id2             = ++requestId;
                            $scope.locationName = '';

                            $scope.mapConfiguration = {
                                zoom    : 8,
                                map_type: mapType,
                            };

                            let tag = dataService.allTags.filter(t => t.name === tagName)[0];

                            socket.send(encodeRequestWithId(id2, 'get_all_locations'));
                            socket.onmessage = (response) => {
                                let parsedResponse = parseResponse(response);
                                if (parsedResponse.id === id2) {
                                    if (parsedResponse.session_state)
                                        window.location.reload();

                                    let locations = parsedResponse.result;


                                    locations.forEach((location) => {
                                        if ((dataService.getTagDistanceFromLocationOrigin(tag, [location.latitude, location.longitude])) <= location.radius) {
                                            $scope.locationName = location.name;
                                        }
                                    });
                                }
                            };

                            NgMap.getMap('search-map').then((map) => {
                                map.set('styles', mapConfiguration);
                                let latLng = new google.maps.LatLng(tag.gps_north_degree, tag.gps_east_degree);

                                map.setCenter(latLng);

                                let marker = new google.maps.Marker({
                                    position: latLng,
                                    map     : map,
                                    icon    : tagsIconPath + 'search-tag.png'
                                });

                                let infoWindow = new google.maps.InfoWindow({
                                    content: '<div class="marker-info-container">' +
                                        '<img src="' + iconsPath + 'login-icon.png" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
                                        '<p class="text-center font-large font-bold color-darkcyan">' + tagName.toUpperCase() + '</p>' +
                                        '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + tag.gps_north_degree + '</b></p></div>' +
                                        '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + tag.gps_east_degree + '</b></p></div>' +
                                        '</div>'
                                });

                                marker.addListener('mouseover', function () {
                                    infoWindow.open(map, this);
                                });

                                marker.addListener('mouseout', function () {
                                    infoWindow.close(map, this);
                                });
                            });

                            $scope.hide = () => {
                                outerScope.selectedTag = '';
                                $mdDialog.hide();
                            }
                        }],
                        onRemoving         : () => {
                            $scope.selectedTag = '';
                        }
                    })
                }
            }
        });

        $scope.$watch('switch.mapFullscreen', function (newValue) {
            if (newValue) {
                openFullScreen(document.querySelector('body'));
            }else if(document.fullscreenElement|| document.webkitFullscreenElement || document.mozFullScreenElement ||
                document.msFullscreenElement){
                document.exitFullscreen();
                $scope.switch.mapFullscreen = false;
            }
        });

        $scope.$watch('switch.showOutdoorRectDrawing', function (newValue) {
            if (newValue) {
                NgMap.getMap('outdoor-map').then((map) => {

                    dataService.drawingManagerRect.setMap(map);

                    google.maps.event.addListener(dataService.drawingManagerRect, 'rectanglecomplete', function (rectangle) {
                        let id = ++requestId;
                        let data = {
                            x_left: rectangle.getBounds().getNorthEast().lat(),
                            y_up: rectangle.getBounds().getNorthEast().lng(),
                            x_right: rectangle.getBounds().getSouthWest().lat(),
                            y_down: rectangle.getBounds().getSouthWest().lng(),
                            color: '#FF0000',
                            location: dataService.location.name
                        };

                        let strigified = JSON.stringify(data);
                        socket.send(encodeRequestWithId(id, 'insert_outdoor_rect_zone', {
                            data: strigified
                        }));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                dataService.outdoorZoneInserted = true;
                            }
                        };
                    });
                });
            }else{
                if (dataService.drawingManagerRect !== null)
                    dataService.drawingManagerRect.setMap(null);
                if (dataService.outdoorZoneInserted)
                    window.location.reload();
            }
            console.log('outdoor drawing');
        });

        $scope.$watch('switch.showOutdoorRoundDrawing', function (newValue) {
            if (newValue) {
                NgMap.getMap('outdoor-map').then((map) => {

                    dataService.drawingManagerRound.setMap(map);

                    google.maps.event.addListener(dataService.drawingManagerRound, 'circlecomplete', function (circle) {
                        let id = ++requestId;
                        let data = {
                            x: circle.getCenter().lat(),
                            y: circle.getCenter().lng(),
                            radius: circle.getRadius() /111000,
                            color: '#FF0000',
                            location: dataService.location.name
                        };

                        let strigified = JSON.stringify(data);
                        socket.send(encodeRequestWithId(id, 'insert_outdoor_round_zone', {
                            data: strigified
                        }));
                        socket.onmessage = (response) => {
                            let parsedResponse = parseResponse(response);
                            if (parsedResponse.id === id){
                                if (parsedResponse.session_state)
                                    window.location.reload();

                                dataService.outdoorZoneInserted = true;
                            }
                        };
                    });
                });
            }else{
                if (dataService.drawingManagerRound !== null)
                    dataService.drawingManagerRound.setMap(null);
                if (dataService.outdoorZoneInserted)
                    window.location.reload();
            }
            console.log('outdoor drawing');
        });
    }

    /**
     * Funciton that handles the change password request
     * @type {string[]}
     */
    recoverPassController.$inject = ['$scope', '$state', 'recoverPassService', '$location'];

    function recoverPassController($scope, $state, recoverPassService) {
        $scope.email          = '';
        $scope.code           = '';
        $scope.username       = '';
        $scope.password       = '';
        $scope.rePassword     = '';
        $scope.error          = '';
        $scope.errorHandeling = {noConnection: false, wrongData: false, passwordNotMatch: false};

        //sending the recoverPassword request
        $scope.sendRecoverPassword = (form) => {
            form.$submitted                    = 'true';
            $scope.errorHandeling.noConnection = false;
            $scope.errorHandeling.wrongData    = false;

            let promise = recoverPassService.recoverPassword($scope.email);

            promise
                .then((response) => {
                    if (response.data.response) {
                        $state.go('recover-password-code');
                    } else {
                        $scope.errorHandeling.wrongData = true;
                    }
                })
                .catch((error) => {
                        $scope.errorHandeling.noConnection = true;
                        console.log('recoverPassword error => ', error);
                    }
                )
        };

        //reseting the password
        $scope.resetPassword = (form) => {
            form.$submitted                        = 'true';
            $scope.errorHandeling.noConnection     = false;
            $scope.errorHandeling.wrongData        = false;
            $scope.errorHandeling.passwordNotMatch = false;

            if ($scope.password !== $scope.rePassword) {
                $scope.errorHandeling.passwordNotMatch = true;
            } else {

                let promise = recoverPassService.resetPassword($scope.code, $scope.username, $scope.password, $scope.rePassword);

                promise
                    .then((response) => {
                            if (response.data.response) {
                                $state.go('login');
                            } else {
                                $scope.errorHandeling.wrongData = true;
                                $scope.error                    = response.data.message;
                            }
                        }
                    ).catch((error) => {
                    $scope.errorHandeling.noConnection = true;
                    console.log('resetPassword error => ', error);
                })
            }
        }
    }
})();
