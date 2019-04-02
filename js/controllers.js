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
        $scope.errorHandeling = {noConnection: false, wrongData: false, socketClosed: socketService.socketClosed};

        // function that makes the log in of the user
        $scope.login = (form) => {
            form.$submitted = 'true';
            if ($scope.user.username !== '' && $scope.user.password !== '') {

                socketService.sendRequest('login', {username: $scope.user.username, password: $scope.user.password})
                    .then((response) => {
                            if (response.result.id !== undefined) {
                                document.cookie = "username=" + $scope.user.username;
                                $state.go('home');
                            } else {
                                $scope.errorHandeling.noConnection = false;
                                $scope.errorHandeling.wrongData    = true;
                            }
                            $scope.$apply();
                        }
                    ).catch(() => {
                        $scope.errorHandeling.wrongData    = false;
                        $scope.errorHandeling.noConnection = true;
                    }
                )
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
    homeController.$inject = ['$scope', '$state', '$mdDialog', '$interval', 'NgMap', 'homeData', 'socketService', 'dataService'];

    function homeController($scope, $state, $mdDialog, $interval, NgMap, homeData, socketService, dataService) {

        let homeCtrl = this;
        let markers  = homeData.markers;
        let bounds   = new google.maps.LatLngBounds();
        let tags     = null;
        let anchors  = null;

        //visualizing the data according if the user is admin or not
        homeCtrl.isAdmin = homeData.isAdmin;

        homeCtrl.dynamicMarkers   = [];
        homeCtrl.mapConfiguration = {
            zoom    : mapZoom,
            map_type: mapType,
            center  : mapCenter
        };

        //function that updates the alert notifications
        let constantUpdateNotifications = () => {
            dataService.homeTimer = $interval(() => {
                socketService.sendConstantAlertRequest('get_all_tags', {})
                    .then((response) => {
                        tags                         = response.result;
                        homeCtrl.showAlarmsIcon      = dataService.checkIfTagsHaveAlarms(response.result);
                        homeCtrl.showOfflineTagsIcon = dataService.checkIfTagsAreOffline(response.result);

                        dataService.playAlarmsAudio(response.result);

                        return socketService.sendConstantAlertRequest('get_anchors_by_user', {user: dataService.username});
                    })
                    .then((response) => {
                        anchors                         = null;
                        homeCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(response.result);
                    })
                    .catch((error) => {
                        console.log('constantUpdateNotification error => ', error);
                    });
            }, 1000);
        };

        constantUpdateNotifications();

        NgMap.getMap('main-map').then((map) => {
            map.set('styles', mapConfiguration);

            markers.forEach((marker) => {
                let markerObject = new google.maps.Marker({
                    position : new google.maps.LatLng(marker.position[0], marker.position[1]),
                    animation: google.maps.Animation.DROP,
                    icon     : markersIconPath + ((marker.icon) ? marker.icon : 'location-marker.png')
                });

                let infoWindow = new google.maps.InfoWindow({
                    content: '<div class="marker-info-container">' +
                        '<img src="' + iconsPath + 'login-icon.png" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
                        '<p class="text-center font-large font-bold color-darkcyan">' + marker.name.toUpperCase() + '</p>' +
                        '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + marker.position[0] + '</b></p></div>' +
                        '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + marker.position[1] + '</b></p></div>' +
                        '</div>'
                });

                markerObject.addListener('mouseover', function () {
                    infoWindow.open(map, this);
                });

                markerObject.addListener('mouseout', function () {
                    infoWindow.close(map, this);
                });

                markerObject.addListener('click', () => {
                    socketService.sendConstantRequest('save_location', {location: marker.name})
                        .then((response) => {
                            if (response.result === 'location_saved') {
                                return socketService.sendConstantRequest('get_location_info', {})
                            }
                        })
                        .then((response) => {
                            dataService.location          = response.result;
                            dataService.defaultFloorName  = '';
                            dataService.locationFromClick = '';
                            (response.result.is_inside)
                                ? $state.go('canvas')
                                : $state.go('outdoor-location');
                        })
                        .catch((error) => {
                            console.log('markerAddListener error => ', error);
                        });
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
                map.setZoom(11);
            }//if the map has more than one marker I let maps to set automatically the zoom
            else {
                map.setCenter(bounds.getCenter());
                map.fitBounds(bounds);
            }
        });

        //showing the info window with the online/offline tags
        homeCtrl.showOfflineTagsHome = () => {
            $interval.cancel(dataService.homeTimer);
            dataService.showOfflineTags(false, constantUpdateNotifications);
        };

        //showing the info window with the online/offline anchors
        homeCtrl.showOfflineAnchorsHome = () => {
            $interval.cancel(dataService.homeTimer);
            dataService.showOfflineAnchors(false, constantUpdateNotifications);
        };

        //showing the info window with all the alarms
        homeCtrl.showAlarmsHome = () => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple: true,
                controller         : ['$scope', 'socketService', 'dataService', ($scope, socketService, dataService) => {
                    let tags      = null;
                    $scope.alarms = [];
                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    socketService.sendRequest('get_all_tags', {})
                        .then((response) => {
                            tags = response.result;
                            dataService.getAllLocations()
                                .then((response) => {
                                    tags.forEach((tag) => {

                                        let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tag, response.result);

                                        tagAlarms.forEach((tagAlarm) => {
                                            $scope.alarms.push(tagAlarm);
                                        })
                                });

                            });
                        })
                        .catch((error) => {
                            console.log('showAlarmsHome error => ', error);
                        });

                    //opening the location where the alarm is
                    $scope.loadLocation = (alarm) => {
                        console.log('loading location');
                        let tag = tags.filter(t => t.name === alarm.tag)[0];

                        if (dataService.isOutdoor(tag)) {
                            socketService.sendRequest('get_all_locations', {})
                                .then((response) => {
                                    response.result.forEach((location) => {
                                        if ((dataService.getTagDistanceFromLocationOrigin(tag, [location.latitude, location.longitude])) <= location.radius) {
                                            socketService.sendRequest('save_location', {location: location.name})
                                                .then((response) => {
                                                    if (response.result === 'location_saved') {
                                                        $state.go('outdoor-location');
                                                    }
                                                })
                                                .catch((error) => {
                                                    console.log('loadLocation error => ', error);
                                                });
                                        }
                                    })
                                })
                                .catch((error) => {
                                    console.log('loadLocation error => ', error);
                                });
                        } else {
                            let indoorTag = [];
                            socketService.sendRequest('get_tags_by_user', {user: dataService.username})
                                .then((response) => {
                                    indoorTag = response.result.filter(t => t.name === tag.name)[0];
                                    return socketService.sendRequest('save_location', {location: indoorTag.location_name});
                                })
                                .then((response) => {
                                    if (response.result === 'location_saved') {
                                        dataService.defaultFloorName  = indoorTag.floor_name;
                                        dataService.locationFromClick = indoorTag.location_name;
                                        $state.go('canvas');
                                    }
                                })
                                .catch((error) => {
                                    console.log('loadLocation error => ', error);
                                });
                        }

                        $mdDialog.hide();
                    };

                    $scope.loadTagPosition = (alarm) => {
                        console.log('loading tag position');
                        $mdDialog.show({
                            locals             : {tagName: alarm, outerScope: $scope},
                            templateUrl        : componentsPath + 'search-tag-outside.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            controller         : ['$scope', 'NgMap', 'tagName', 'outerScope', 'socketService', function ($scope, NgMap, tagName, outerScope, socketService) {

                                let tag             = null;

                                $scope.isTagOutOfLocation = 'background-red';
                                $scope.locationName = tagName.tag + ' FUORI SITO';
                                $scope.mapConfiguration = {
                                    zoom    : 8,
                                    map_type: mapType,
                                };

                                socketService.sendRequest('get_all_tags', {})
                                    .then((response) => {
                                        tag = response.result.filter(t => t.name === tagName.tag)[0];
                                        return socketService.sendRequest('get_tag_outside_location_zoom');
                                    })
                                    .then((response) => {
                                        $scope.mapConfiguration.zoom = response.result;
                                        console.log(response.result);
                                    })
                                    .catch((error) => {
                                        console.error('loadTagPosition error => ', error);
                                    });

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
                                    outerScope.selectedTag = '';
                                    $mdDialog.hide();
                                }
                            }]
                        })
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        //on destroying the pag I release the resources
        $scope.$on('$destroy', function () {
            $mdDialog.hide();
            $interval.cancel(dataService.homeTimer);
            $interval.cancel(dataService.mapInterval);
        })
    }

    /**
     * Function that manages the login map
     * @type {string[]}
     */
    outdoorController.$inject = ['$scope', '$state', '$interval', '$mdDialog', 'NgMap', 'socketService', 'dataService', 'outdoorData'];

    function outdoorController($scope, $state, $interval, $mdDialog, NgMap, socketService, dataService, outdoorData) {
        let outdoorCtrl  = this;
        let tags         = null;
        let bounds       = new google.maps.LatLngBounds();
        let locationInfo = [];

        dataService.updateMapTimer = null;
        dataService.dynamicTags    = [];

        outdoorCtrl.isAdmin = outdoorData.isAdmin;

        outdoorCtrl.mapConfiguration = {
            zoom    : 7,
            map_type: mapType,
            center  : mapCenter
        };

        //showing the info window with the online/offline tags
        outdoorCtrl.showOfflineTags = () => {
            dataService.showOfflineTags(true);
        };

        //showing the info window with the online/offline anchors
        outdoorCtrl.showOfflineAnchors = () => {
            dataService.showOfflineAnchors(true);
        };

        //showing the info window with all the alarms
        outdoorCtrl.showAlarms = () => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple: true,
                controller         : ['$scope', 'socketService', 'dataService', ($scope, socketService, dataService) => {
                    let tags      = null;
                    $scope.alarms = [];
                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    socketService.sendRequest('get_all_tags', {user: dataService.username})
                        .then((response) => {
                            tags = response.result;
                            dataService.getAllLocations()
                                .then((response) => {
                                    tags.forEach((tag) => {

                                        let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tag, response.result);

                                        tagAlarms.forEach((tagAlarm) => {
                                            $scope.alarms.push(tagAlarm);
                                        })
                                    });

                                });
                        })
                        .catch((error) => {
                            console.log('showAlarmsOutdoor error => ', error);
                        });

                    //function that load a location when an alarm is clicked
                    $scope.loadLocation = (alarm) => {
                        let tag = tags.filter(t => t.name === alarm.tag)[0];

                        socketService.sendRequest('save_location', {location: tag.location_name})
                            .then(() => {
                                if (!dataService.isOutdoor(tag)) {
                                    socketService.sendRequest('get_tags_by_user', {user: dataService.username})
                                        .then((response) => {
                                            let indoorTag = response.result.filter(t => t.name === tag.name)[0];

                                            socketService.sendRequest('save_location', {location: indoorTag.location_name})
                                                .then((response) => {
                                                    if (response.result === 'location_saved') {
                                                        dataService.defaultFloorName  = indoorTag.floor_name;
                                                        dataService.locationFromClick = indoorTag.location_name;
                                                        $state.go('canvas');
                                                    }
                                                })
                                                .catch((error) => {
                                                    console.log('loadLocationOutdoor error => ', error);
                                                });
                                        })
                                        .catch((error) => {
                                            console.log('loadLocationOutdoor error => ', error);
                                        });
                                } else {
                                    socketService.sendRequest('get_all_locations', {})
                                        .then((response) => {
                                            response.result.forEach((location) => {
                                                if ((dataService.getTagDistanceFromLocationOrigin(tag, [location.latitude, location.longitude])) <= location.radius) {
                                                    socketService.sendRequest('save_location', {location: location.name})
                                                        .then((response) => {
                                                            if (response.result === 'location_saved') {
                                                            }
                                                        })
                                                        .catch((error) => {
                                                            console.log('loadLocationOutdoor error => ', error);
                                                        });
                                                }
                                            });
                                        })
                                        .catch((error) => {
                                            console.log('loadLocationOutdoor error => ', error);
                                        });
                                }
                                $mdDialog.hide();
                            })
                            .catch((error) => {
                                console.log('loadLocationOutdoor error => ', error);
                            });
                    };

                    $scope.loadTagPosition = (alarm) => {
                        console.log('loading tag position');
                        $mdDialog.show({
                            locals             : {tagName: alarm, outerScope: $scope},
                            templateUrl        : componentsPath + 'search-tag-outside.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            controller         : ['$scope', 'NgMap', 'tagName', 'outerScope', 'socketService', function ($scope, NgMap, tagName, outerScope, socketService) {

                                let tag             = null;

                                $scope.isTagOutOfLocation = 'background-red';
                                $scope.locationName = tagName.tag + ' FUORI SITO';
                                $scope.mapConfiguration = {
                                    zoom    : 8,
                                    map_type: mapType,
                                };

                                socketService.sendRequest('get_all_tags', {})
                                    .then((response) => {
                                        tag = response.result.filter(t => t.name === tagName.tag)[0];
                                        return socketService.sendRequest('get_tag_outside_location_zoom');
                                    })
                                    .then((response) => {
                                        $scope.mapConfiguration.zoom = response.result;
                                        console.log(response.result);
                                    })
                                    .catch((error) => {
                                        console.error('loadTagPosition error => ', error);
                                    });

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
                                    outerScope.selectedTag = '';
                                    $mdDialog.hide();
                                }
                            }]
                        })
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        //calculating the distance of the tag from the location center
        let getTagDistanceFromLocationOrigin = (tag, origin) => {
            let distX = Math.abs(tag.gps_north_degree - origin[0]);
            let distY = Math.abs(tag.gps_east_degree - origin[1]);

            return Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2));
        };

        NgMap.getMap('outdoor-map').then((map) => {
            map.set('styles', mapConfiguration);

            if (!dataService.isSearchingTag)
                constantUpdateMapTags(map);

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
        let constantUpdateMapTags = (map) => {
            let tagAlarms       = [];
            let alarmsCounts    = new Array(100).fill(0);
            let prevAlarmCounts = new Array(100).fill(0);
            let localTags       = [];

            socketService.sendRequest('get_location_info', {})
                .then((response) => {
                    locationInfo = response.result;

                    new google.maps.Circle({
                        strokeColor  : '#0093c4',
                        strokeOpacity: 0.9,
                        strokeWeight : 3,
                        fillColor    : '#0093c4',
                        fillOpacity  : 0.03,
                        map          : map,
                        center       : new google.maps.LatLng(locationInfo.latitude, locationInfo.longitude),
                        radius       : locationInfo.radius * 111000,
                    });

                    dataService.updateMapTimer = $interval(() => {
                        socketService.sendConstantRequest('get_all_tags', {})
                            .then((response) => {
                                tags = response.result;

                                outdoorCtrl.showAlarmsIcon      = dataService.checkIfTagsHaveAlarms(response.result);
                                outdoorCtrl.showOfflineTagsIcon = dataService.checkIfTagsAreOffline(response.result);

                                dataService.playAlarmsAudio(response.result);

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
                                        if ((getTagDistanceFromLocationOrigin(tag, [locationInfo.latitude, locationInfo.longitude])) <= locationInfo.radius) {
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
                                            });

                                            if ((new Date(Date.now()) - (new Date(tag.gps_time)) < tag.sleep_time_outdoor)) {
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
                                    map.setZoom(mapZoom)
                                } else if (dataService.dynamicTags.length > 1) {
                                    map.setCenter(bounds.getCenter());
                                    map.fitBounds(bounds);
                                } else {
                                    let latLng = new google.maps.LatLng(dataService.location.latitude, dataService.location.longitude);
                                    map.setCenter(latLng);
                                    map.setZoom(mapZoom)
                                }

                                return socketService.sendRequest('get_anchors_by_user', {user: dataService.username})
                            })
                            .then((response) => {
                                outdoorCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(response.result);
                            })
                            .catch((error) => {
                                console.log('constantUpdateMapTags error => ', error)
                            });
                    }, 1000)
                })
        };

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
                marker.setIcon(tagsIconPath + 'man-down-disabled.png');
            } else if (tag.man_down_tacitated) {
                marker.setIcon(tagsIconPath + 'man-down-tacitated.png');
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
    canvasController.$inject = ['$scope', '$state', '$mdDialog', '$timeout', '$interval', '$mdSidenav', 'socketService', 'dataService'];

    function canvasController($scope, $state, $mdDialog, $timeout, $interval, $mdSidenav, socketService, dataService) {
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
        let newBegin           = [];
        let newEnd             = [];
        let anchorToDrop       = '';

        canvasCtrl.canvasInterval         = undefined;
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
            location        : (dataService.locationFromClick === '') ? dataService.location : dataService.locationFromClick,
            floor_image_map : canvasCtrl.defaultFloor[0].image_map
        };

        //drawing button
        canvasCtrl.speedDial = {
            isOpen           : false,
            selectedDirection: 'left',
            mode             : 'md-scale',
            clickedButton    : 'horizontal'
        };

        dataService.loadUserSettings();

        //watching for changes in switch buttons in menu
        $scope.$watchGroup(['dataService.switch.showGrid', 'dataService.switch.showAnchors', 'dataService.switch.showCameras', 'dataService.switch.showFullscreen', 'canvasCtrl.floorData.gridSpacing', 'dataService.switch.showDrawing'], function (newValues) {
            if (canvasCtrl.defaultFloor[0].map_spacing !== newValues[4])
                canvasCtrl.defaultFloor[0].map_spacing = newValues[4];

            if (newValues[3]) {
                openFullScreen(document.querySelector('#canvas-container'));
                dataService.switch.fullscreen = false;
            }

            if (newValues[5] === true) {
                dataService.switch.showAnchors     = false;
                dataService.switch.showCameras     = false;
                canvasCtrl.showAlarmsIcon         = false;
                canvasCtrl.showOfflineTagsIcon    = false;
                canvasCtrl.showOfflineAnchorsIcon = false;
                canvasCtrl.speedDial.clickedButton = 'horizontal';

                $mdSidenav('left').close();

                $interval.cancel(canvasCtrl.canvasInterval);
                canvasCtrl.canvasInterval = undefined;
                dragingImage.src          = imagePath + 'floors/' + canvasCtrl.floorData.floor_image_map;

                socketService.sendRequest('get_drawing', {floor: canvasCtrl.defaultFloor[0].id})
                    .then((response) => {
                        dragingImage.onload = () => {
                            let parsedResponse = JSON.parse(response.result);
                            drawedLines        = (parsedResponse === null) ? [] : parsedResponse;

                            if (drawedLines !== null)
                                updateDrawingCanvas(drawedLines, canvas.width, canvas.height, context, dragingImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, dataService.switch.showDrawing);
                        }
                    })
            } else if (newValues[5] === false) {
                console.log('show drawing false');
                console.log(canvasCtrl.canvasInterval);
                if (canvasCtrl.canvasInterval === undefined){
                    if (angular.element(document).find('md-dialog').length === 0) {
                        console.log('constant updating canvas');
                        constantUpdateCanvas();
                    }
                }
            }
        });

        // //watching the fullscreen switch button
        // $scope.$watch('dataService.switch.fullscreen', (newValue) => {
        //     if (newValue) {
        //         openFullScreen(document.querySelector('#canvas-container'));
        //         dataService.switch.fullscreen = false;
        //     }
        // });

        //watching the floor selection button
        $scope.$watch('canvasCtrl.floorData.defaultFloorName', (newValue) => {
            if (newValue !== undefined)
                canvasCtrl.defaultFloor = [dataService.userFloors.filter(f => {
                    return f.name === newValue
                })[0]];

            canvasCtrl.floorData.defaultFloorName = canvasCtrl.defaultFloor[0].name;
            dataService.defaultFloorName = canvasCtrl.defaultFloor[0].name;
            canvasCtrl.floorData.gridSpacing      = canvasCtrl.defaultFloor[0].map_spacing;
            canvasCtrl.floorData.floor_image_map  = canvasCtrl.defaultFloor[0].image_map;
            context.clearRect(0, 0, canvas.width, canvas.height);
            $interval.cancel(canvasCtrl.canvasInterval);
            if (canvasCtrl.canvasInterval === undefined) constantUpdateCanvas();
        });

        //function that handles the click on the drawing mode
        canvasCtrl.speedDialClicked = (button) => {
            if (button === 'drop_anchor') {
                $mdDialog.show({
                    templateUrl        : componentsPath + 'select_drop_anchor.html',
                    parent             : angular.element(document.body),
                    targetEvent        : event,
                    clickOutsideToClose: true,
                    controller         : ['$scope', 'socketService', 'dataService', ($scope, socketService, dataService) => {
                        $scope.selectedAnchor = '';
                        $scope.anchors        = [];
                        socketService.sendRequest('get_anchors_by_location', {location: dataService.location})
                            .then((response) => {
                                $scope.anchors = response.result;
                            })
                            .catch((error) => {
                                console.log('speedDialClicked error => ', error);
                            });

                        $scope.$watch('selectedAnchor', (newValue) => {
                            let currentValue = "" + newValue;
                            if (currentValue !== '') {
                                anchorToDrop = currentValue;
                                $mdDialog.hide();
                                drawAnchorImage     = new Image();
                                drawAnchor          = $scope.anchors.filter(a => a.name === newValue)[0];
                                drawAnchorImage.src = tagsIconPath + 'anchor_online_24.png';

                                drawAnchorImage.onload = () => {
                                    let realHeight     = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;
                                    dropAnchorPosition = scaleIconSize(drawAnchor.x_pos, drawAnchor.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);

                                    context.drawImage(drawAnchorImage, dropAnchorPosition.width, dropAnchorPosition.height);
                                }
                            }
                        });

                        $scope.hide = () => {
                            $mdDialog.hide();
                        }
                    }]
                })
            } else if (button === 'vertical') {
                canvasCtrl.drawingImage = 'vertical-line.png';
            } else if (button === 'horizontal') {
                canvasCtrl.drawingImage = 'horizontal-line.png';
            } else if (button === 'inclined') {
                canvasCtrl.drawingImage = 'inclined-line.png';
            } else if (button === 'delete') {
                canvasCtrl.drawingImage = 'erase_24.png';
            }

            canvasCtrl.speedDial.clickedButton = button;
        };

        //function that loads the floor map and starts the constant update of the floor
        canvasCtrl.loadFloor = () => {
            let img = new Image();
            img.src = imagePath + 'floors/' + canvasCtrl.floorData.floor_image_map;

            img.onload = function () {
                canvas.width  = this.naturalWidth;
                canvas.height = this.naturalHeight;

                //updating the canvas and drawing border
                updateCanvas(canvas.width, canvas.height, context, img);
            };

            //constantly updating the canvas
            if (canvasCtrl.canvasInterval === undefined)
               constantUpdateCanvas();
        };

        //controlling the alarms and setting the alarm icon
        let assigningTagImage = (tag, image) => {
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
        let loadImagesAsynchronouslyWithPromise = (data, image) => {
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
                                    if (dataService.checkIfTagHasAlarm(value[0])) {
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

        //constantly updating the canvas with the objects position from the server
        let constantUpdateCanvas = () => {
            let alarmsCounts          = new Array(100).fill(0);
            canvasImage.onload = function () {
                canvas.width = this.naturalWidth;
                canvas.height = this.naturalHeight;
                bufferCanvas.width  = this.naturalWidth;
                bufferCanvas.height = this.naturalHeight;

                canvasCtrl.canvasInterval = $interval(function () {

                    //updating the canvas and drawing border
                    updateCanvas(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasImage);

                    console.log('showing grid: ', dataService.switch.showGrid);
                    if (dataService.switch.showGrid) {
                        //drawing vertical
                        drawDashedLine(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, 'vertical');
                        //drawing horizontal lines
                        drawDashedLine(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, 'horizontal');
                    }

                    socketService.sendConstantRequest('get_floors_by_location', {location: dataService.location})
                        .then((response) => {
                            if (!angular.equals(canvasCtrl.floors, response.result)) {
                                let newFloor      = response.result.filter(f => !canvasCtrl.floors.some(cf => f.id === cf.id))[0];
                                canvasCtrl.floors = response.result;
                                dataService.userFloors.push(newFloor);
                            }
                            return socketService.sendConstantRequest('get_drawing', {floor: canvasCtrl.defaultFloor[0].id})
                        })
                        //managing drawing visualizzation
                        .then((response) => {
                            let parsedDraw = JSON.parse(response.result);
                            if (parsedDraw !== null) {
                                parsedDraw.forEach((line) => {
                                    drawLine(line.begin, line.end, line.type, bufferContext, dataService.switch.showDrawing);
                                });
                            }
                            return socketService.sendConstantRequest('get_anchors_by_floor_and_location', {
                                floor   : canvasCtrl.floorData.defaultFloorName,
                                location: canvasCtrl.floorData.location
                            })
                        })
                        //managing the anchors visualization
                        .then((response) => {
                            dataService.anchors = response.result;
                            if (response.result.length > 0) {
                                loadAndDrawImagesOnCanvas(response.result, 'anchor', dataService.switch.showAnchors);
                                canvasCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(response.result);
                            }

                            return socketService.sendConstantRequest('get_cameras_by_floor_and_location', {
                                floor   : canvasCtrl.floorData.defaultFloorName,
                                location: canvasCtrl.floorData.location
                            })
                        })
                        //managing the cameras visualizzation
                        .then((response) => {
                            if (response.result.length > 0)
                                loadAndDrawImagesOnCanvas(response.result, 'camera', dataService.switch.showCameras);

                            dataService.cameras = response.result;

                            return socketService.sendConstantRequest('get_tags_by_floor_and_location', {
                                floor   : canvasCtrl.defaultFloor[0].id,
                                location: canvasCtrl.floorData.location
                            });
                        })
                        //managing the tags visualizzation
                        .then((response) => {
                            dataService.playAlarmsAudio(response.result);
                            dataService.floorTags = response.result;

                            let tagClouds            = [];
                            let isolatedTags         = [];
                            let singleAndGroupedTags = [];
                            let step                 = 0;

                            let temporaryTagsArray = {
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

                            loadImagesAsynchronouslyWithPromise(tagClouds, 'tag')
                                .then((images) => {
                                    //control if there are clouds to bhe shown
                                    if (images !== null) {
                                        //drawing the clouds on the canvas
                                        images.forEach(function (image, index) {
                                            drawCloudIcon(tagClouds[index][0], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[0].length);
                                        });
                                    }

                                    return loadImagesAsynchronouslyWithPromise(isolatedTags, 'tag');
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
                                                    } else if (!(tag[0].is_exit && tag[0].radio_switched_off)) {
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

                            return socketService.sendConstantRequest('get_all_tags', {user: dataService.username})
                        })
                        .then((response) => {
                            canvasCtrl.showAlarmsIcon      = checkTagsStateAlarmNoAlarmOffline(response.result).withAlarm;
                            //showing the offline anchors and alarm button
                            canvasCtrl.showOfflineTagsIcon = dataService.checkIfTagsAreOffline(response.result);
                        })
                        .catch((error) => {
                            console.log('constantUpdateCanvas error => ', error);
                        })

                }, 1000);
            };

            canvasImage.src = floorPath + canvasCtrl.floorData.floor_image_map;
        };

        canvasCtrl.loadFloor();

        //loading images and drawing them on canvas
        let loadAndDrawImagesOnCanvas = (objects, objectType, hasToBeDrawn) => {
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
        HTMLCanvasElement.prototype.canvasMouseClickCoords = function(event) {
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
            socketService.sendConstantRequest('save_drawing', {
                lines: JSON.stringify(drawedLines),
                floor: canvasCtrl.defaultFloor[0].id
            })
            .then(() => {
                if (drawAnchor !== null) {
                    let scaledSize = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, dropAnchorPosition.width, dropAnchorPosition.height);
                    socketService.sendConstantRequest('update_anchor_position', {
                        x : scaledSize.x.toFixed(2),
                        y : scaledSize.y.toFixed(2),
                        id: drawAnchor.id
                    })
                    .then((response) => {
                        if (response.result !== 0) {
                            console.log('anchor position updated');
                        }
                    })
                    .catch((error) => {
                        console.log('saveDrawing errro => ', error);
                    })
                }

                dataService.switch.showAnchors = true;
                dataService.switch.showCameras = true;
                dataService.switch.showDrawing = false;

                dropAnchorPosition                 = null;
                drawAnchorImage                    = null;
                canvasCtrl.speedDial.clickedButton = '';
                if (canvasCtrl.canvasInterval === undefined) constantUpdateCanvas();
            })
            .catch((error) => {
                console.log('saveDrawing error => ', error);
            })
        };

        //handeling the canvas click
        canvas.addEventListener('mousemove', (event) => {
            if (dataService.switch !== undefined && dataService.switch.showDrawing) {
                if (drawedLines !== null) {
                    updateDrawingCanvas(drawedLines, canvas.width, canvas.height, context, dragingImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, dataService.switch.showDrawing);

                    if (dragingStarted === 1) {
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
                if (drawAnchorImage !== null) {
                    context.drawImage(drawAnchorImage, dropAnchorPosition.width, dropAnchorPosition.height);
                }
            }
        });

        //handeling the mouse move on the canvas
        canvas.addEventListener('mousedown', function (event) {
            let tagCloud    = null;
            let dialogShown = false;
            let realHeight  = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;
            mouseDownCoords = canvas.canvasMouseClickCoords(event);

            //drawing on canvas
            if (dataService.switch.showDrawing && canvasCtrl.speedDial.clickedButton !== 'delete' && canvasCtrl.speedDial.clickedButton !== 'drop_anchor') {
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
                dropAnchorPosition = {width: mouseDownCoords.x, height: mouseDownCoords.y};
                context.drawImage(drawAnchorImage, dropAnchorPosition.width, dropAnchorPosition.height);
            }

            //deleting drawings
            if (canvasCtrl.speedDial.clickedButton === 'delete') {
                let toBeRemoved = drawedLines.filter(l => ((l.begin.x - 5 <= mouseDownCoords.x && mouseDownCoords.x <= l.begin.x + 5) && (l.begin.y - 5 <= mouseDownCoords.y && mouseDownCoords.y <= l.begin.y + 5))
                    || ((l.end.x - 5 <= mouseDownCoords.x && mouseDownCoords.x <= l.end.x + 5) && (l.end.y - 5 <= mouseDownCoords.y && mouseDownCoords.y <= l.end.y + 5)));


                if (toBeRemoved.length > 0) {
                    drawedLines = drawedLines.filter(l => !toBeRemoved.some(r => r.begin.x === l.begin.x && r.begin.y === l.begin.y
                        && r.end.x === l.end.x && r.end.y === l.end.y));

                    updateDrawingCanvas(drawedLines, canvas.width, canvas.height, context, dragingImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, dataService.switch.showDrawing);
                }
            }

            //listen for the tags click
            dataService.floorTags.forEach(function (tag) {
                let virtualTagPosition = scaleIconSize(tag.x_pos, tag.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                tagCloud               = groupNearTags(dataService.floorTags, tag);

                if ((tag.gps_north_degree === 0 || tag.gps_east_degree === 0) && !dataService.switch.showDrawing) {
                    if (((virtualTagPosition.width - 45) < mouseDownCoords.x && mouseDownCoords.x < (virtualTagPosition.width + 45)) && ((virtualTagPosition.height - 45) < mouseDownCoords.y && mouseDownCoords.y < (virtualTagPosition.height + 45))) {
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

                                        tagCloud.groupTags.forEach(function (tagElem) {
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
                                if (!(tag.is_exit && tag.radio_switched_off)) {
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

                                            $scope.hide = () =>  {
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
                if (!isTagAtCoords(mouseDownCoords) && !dataService.switch.showDrawing) {
                    let virtualAnchorPosition = scaleIconSize(anchor.x_pos, anchor.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                    if (((virtualAnchorPosition.width - 20) < mouseDownCoords.x && mouseDownCoords.x < (virtualAnchorPosition.width + 20)) && ((virtualAnchorPosition.height - 20) < mouseDownCoords.y && mouseDownCoords.y < (virtualAnchorPosition.height + 20))) {
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
                if (!isTagAtCoords(mouseDownCoords) && !dataService.switch.showDrawing) {
                    let virtualCamerasPosition = scaleIconSize(camera.x_pos, camera.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                    if (((virtualCamerasPosition.width - 20) < mouseDownCoords.x && mouseDownCoords.x < (virtualCamerasPosition.width + 20)) && ((virtualCamerasPosition.height - 20) < mouseDownCoords.y && mouseDownCoords.y < (virtualCamerasPosition.height + 20))) {
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
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'socketService', 'dataService', function ($scope, socketService, dataService) {
                    let tags      = null;
                    $scope.alarms = [];
                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    socketService.sendRequest('get_all_tags')
                        .then((response) => {
                            tags = response.result;
                            dataService.getAllLocations()
                                .then((response) => {
                                    tags.forEach((tag) => {

                                        let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tag, response.result);

                                        tagAlarms.forEach((tagAlarm) => {
                                            $scope.alarms.push(tagAlarm);
                                        })
                                    });

                                });
                        })
                        .catch((error) => {
                            console.log('showAlarms error => ', error);
                        });

                    //handeling the click of an alarm and opening the associate location
                    $scope.loadLocation = (alarm) => {
                        let outdoorTag = tags.filter(t => t.name === alarm.tag)[0];

                        if (dataService.isOutdoor(outdoorTag)) {
                            socketService.sendRequest('get_all_locations', {})
                                .then((response) => {
                                    response.result.forEach((location) => {
                                        if ((dataService.getTagDistanceFromLocationOrigin(outdoorTag, [location.latitude, location.longitude])) <= location.radius) {
                                            socketService.sendRequest('save_location', {location: location.name})
                                                .then((response) => {
                                                    if (response.result === 'location_saved') {

                                                        $state.go('outdoor-location');
                                                    }
                                                })
                                                .catch((error) => {
                                                    console.log('loadLocation error => ', error);
                                                })
                                        }
                                    });
                                })
                                .catch((error) => {
                                    console.log('loadLocation error => ', error);
                                });

                            //TODO - have to see all the locations and see on wich location the tag is in range
                        } else {
                            socketService.sendRequest('get_tags_by_user', {user: dataService.username})
                                .then((response) => {
                                    let tag                               = response.result.filter(t => t.name === alarm.tag)[0];
                                    canvasCtrl.floorData.defaultFloorName = tag.floor_name;
                                    canvasCtrl.floorData.location         = tag.location_name;
                                })
                                .catch((error) => {
                                    console.log('loadLocation error => ', error);
                                })
                        }

                        $mdDialog.hide();
                    };

                    $scope.loadTagPosition = (alarm) => {
                        console.log('loading tag position');
                        $mdDialog.show({
                            locals             : {tagName: alarm, outerScope: $scope},
                            templateUrl        : componentsPath + 'search-tag-outside.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            controller         : ['$scope', 'NgMap', 'tagName', 'outerScope', 'socketService', function ($scope, NgMap, tagName, outerScope, socketService) {

                                let tag             = null;

                                $scope.isTagOutOfLocation = 'background-red';
                                $scope.locationName = tagName.tag + ' FUORI SITO';
                                $scope.mapConfiguration = {
                                    zoom    : 8,
                                    map_type: mapType,
                                };


                                socketService.sendRequest('get_all_tags', {})
                                    .then((response) => {
                                        tag = response.result.filter(t => t.name === tagName.tag)[0];
                                        return socketService.sendRequest('get_tag_outside_location_zoom');
                                    })
                                    .then((response) => {
                                        $scope.mapConfiguration.zoom = response.result;
                                        console.log(response.result);
                                    })
                                    .catch((error) => {
                                        console.error('loadTagPosition error => ', error);
                                    });

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
                                    outerScope.selectedTag = '';
                                    $mdDialog.hide();
                                }
                            }]
                        })
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        //function that control if the there is a tag at the coordinates passed as parameter
        let isTagAtCoords = (coords) => {
            return dataService.floorTags.some(function (tag) {
                let realHeight         = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;
                let virtualTagPosition = scaleIconSize(tag.x_pos, tag.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                return (tag.gps_north_degree === 0 || tag.gps_east_degree === 0) && (((virtualTagPosition.width - 20) < coords.x && coords.x < (virtualTagPosition.width + 20)) && ((virtualTagPosition.height - 20) < coords.y && coords.y < (virtualTagPosition.height + 20)));
            })
        };

        //showing the info window with the online/offline tags
        $scope.showOfflineTagsIndoor = () => {
            dataService.showOfflineTags(true);
        };

        //showing the info window with the online/offline anchors
        $scope.showOfflineAnchorsIndoor = () => {
            dataService.showOfflineAnchors(true);
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
                    $scope.labels = ["Persone in zona di evacuazione", "Persone disperse"];

                    socketService.sendRequest('get_emergency_info', {location: dataService.location, floor: floor})
                        .then((response) => {
                            $scope.safeTags   = response.result;
                            $scope.unsafeTags = tags.filter(t => !response.result.some(i => i.tag_name === t.name));

                            $scope.men.safe   = response.result.length;
                            $scope.men.unsafe = tags.length - response.result.length;

                            $scope.data = [$scope.men.safe, $scope.men.unsafe];
                        })
                        .catch((error) => {
                            console.log('showEmergencyZone error => ', error);
                        });

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
            $interval.cancel(canvasCtrl.canvasInterval);
        });
    }

    /**
     * Function that handle the menu interaction
     * @type {string[]}
     */
    menuController.$inject = ['$scope', '$mdDialog', '$mdEditDialog', '$location', '$state', '$filter', '$timeout', '$mdSidenav', '$interval', '$element', 'NgMap', 'dataService', 'socketService'];

    function menuController($scope, $mdDialog, $mdEditDialog, $location, $state, $filter, $timeout, $mdSidenav, $interval, $element, NgMap, dataService, socketService) {

        $scope.menuTags    = dataService.allTags;
        $scope.isAdmin     = dataService.isAdmin;
        $scope.selectedTag = '';
        $scope.switch      = {
            mapFullscreen: false
        };

        //opening and closing the menu
        $scope.toggleLeft = () => {
            $mdSidenav('left').toggle();
        };

        //function that show the locations table
        $scope.openLocations = () => {

            let locationsHasChanged     = false;
            let locationsHasBeenDeleted = false;

            let locationDialog = {
                locals             : {admin: $scope.isAdmin},
                templateUrl        : componentsPath + 'locations-table.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected       = [];
                    $scope.locationsTable = [];
                    $scope.tableEmpty     = false;
                    $scope.query          = {
                        limitOptions: [5, 10, 15],
                        limit       : 5,
                        page        : 1
                    };

                    socketService.sendConstantRequest('get_locations_by_user', {user: dataService.username})
                        .then((response) => {
                            $scope.locationsTable = response.result;
                            $scope.tableEmpty     = $scope.locationsTable.length === 0;

                            dataService.mapInterval = $interval(function () {
                                socketService.sendConstantRequest('get_locations_by_user', {user: dataService.username})
                                    .then((response) => {
                                        $scope.tableEmpty = $scope.locationsTable.length === 0;
                                        if (!angular.equals($scope.locationsTable, response.result)) {
                                            locationsHasChanged   = true;
                                            $scope.locationsTable = response.result;
                                        }

                                        if (angular.element(document).find('md-dialog').length === 0) {
                                            if (locationsHasChanged || locationsHasBeenDeleted) {
                                                locationsHasChanged     = false;
                                                locationsHasBeenDeleted = false;
                                                window.location.reload();
                                            }
                                            $interval.cancel(dataService.mapInterval);
                                        }
                                    })
                                    .catch((error) => {
                                        console.log('locationDialog error => ', error);
                                    });
                            }, 1000);
                        })
                        .catch((error) => {
                            console.log('locationDialog error => ', error);
                        });


                    $scope.editCell = (event, location, locationName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue : location[locationName],
                                save       : function (input) {
                                    input.$invalid         = true;
                                    location[locationName] = input.$modelValue;
                                    socketService.sendRequest('change_location_field', {
                                        location_id   : location.id,
                                        location_field: locationName,
                                        field_value   : input.$modelValue
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

                    //deleting a location
                    $scope.deleteRow = (location) => {
                        let confirm = $mdDialog.confirm()
                            .title('CANCELLAZIONE SITO')
                            .textContent('Sei sicuro di voler cancellare il sito?')
                            .targetEvent(event)
                            .multiple(true)
                            .ok('CANCELLA SITO')
                            .cancel('ANNULLA');

                        $mdDialog.show(confirm).then(() => {
                            socketService.sendRequest('delete_location', {location_id: location.id})
                                .then((response) => {
                                    if (response.result.length === 0) {
                                        locationsHasBeenDeleted = true;
                                        $scope.locationsTable   = $scope.locationsTable.filter(t => t.id !== location.id);
                                    }
                                })
                                .catch((error) => {
                                    console.log('deleteRow error => ', error);
                                });
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
                        $interval.cancel(dataService.mapInterval);
                        if (locationsHasChanged || locationsHasBeenDeleted) window.location.reload();
                        locationsHasChanged     = false;
                        locationsHasBeenDeleted = false;
                    }
                }]
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

                            socketService.sendRequest('get_user', {})
                                .then((response) => {

                                    return socketService.sendRequest('insert_location', {
                                        user       : response.result.id,
                                        name       : $scope.location.name,
                                        description: $scope.location.description,
                                        latitude   : $scope.location.latitude,
                                        longitude  : $scope.location.longitude,
                                        imageName  : (fileName === null) ? '' : fileName,
                                        radius     : ($scope.location.isIndoor) ? '' : $scope.location.radius,
                                        is_indoor  : $scope.location.isIndoor
                                    })
                                })
                                .then((response) => {
                                    if (response.result.length === 0) {
                                        if (file != null) {
                                            return convertImageToBase64(file);
                                        }
                                    } else {
                                        $scope.location.showSuccess = false;
                                        $scope.location.showError   = true;
                                        $scope.location.message     = 'Impossibile inserire la posizione.';
                                        $scope.location.resultClass = 'background-red';
                                        $scope.$apply();
                                        return null
                                    }
                                })
                                .then((response) => {
                                    if (response !== null) {
                                        return socketService.sendRequest('save_marker_image', {
                                            imageName: fileName,
                                            image    : response
                                        })
                                    }
                                })
                                .then((response) => {
                                    if (response.result === false) {
                                        $scope.location.showSuccess = false;
                                        $scope.location.showError   = true;
                                        $scope.location.message     = "Posizione inserita senza salvare l'immagine";
                                        $scope.resultClass          = 'background-orange';

                                        $scope.$apply();

                                        // $timeout(function () {
                                        // $mdDialog.hide();
                                        // window.location.reload();
                                        // }, 1000);
                                    } else {
                                        $scope.location.resultClass = 'background-green';
                                        $scope.location.showSuccess = true;
                                        $scope.location.showError   = false;
                                        $scope.location.message     = 'Posizione inserita con successo';

                                        $scope.$apply();

                                        $timeout(function () {
                                            $mdDialog.hide();
                                            // window.location.reload();
                                        }, 1000);
                                    }
                                }).catch(function () {
                                    $scope.location.showSuccess = false;
                                    $scope.location.showError   = true;
                                    $scope.location.message     = 'Impossibile inserire la posizione';
                                    $scope.location.resultClass = 'background-red';
                                })
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

        //history table
        $scope.viewHistory = function () {
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
                            .then((response) => {
                                $scope.history.events = response.result;
                                return socketService.sendRequest('get_all_tags', {});
                            })
                            .then((response) => {
                                $scope.history.tags = response.result;
                                // $scope.$apply();
                                return socketService.sendRequest('get_history', {
                                    fromDate: fromDate,
                                    toDate  : toDate,
                                    tag     : newValues[2],
                                    event   : newValues[3]
                                })
                            })
                            .then((response) => {
                                $scope.historyRows = response.result;
                                $scope.tableEmpty  = $scope.historyRows.length === 0;
                                $scope.$apply();
                            })
                            .catch((error) => {
                                console.log('history error => ', error);
                            });
                    });

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
                            $scope.changePassword.message     = "Le password devono coincidere!";
                        } else {
                            if (form.$valid) {

                                socketService.sendRequest('change_password', {
                                    oldPassword: $scope.changePassword.oldPassword,
                                    newPassword: $scope.changePassword.newPassword
                                })
                                .then((response) => {
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

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            });
        };

        //function that handle the tags crud
        $scope.registry = () => {
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

                    socketService.sendRequest('get_all_types', {})
                        .then((response) => {
                            $scope.tagTypes = response.result;
                        })
                        .catch((error) => {
                            console.log('registry error => ', error);
                        });

                    //insert a tag
                    $scope.addTag = function (form) {
                        form.$submitted = true;

                        if (form.$valid) {
                            socketService.sendRequest('insert_tag', {
                                name: $scope.insertTag.name,
                                type: $scope.selectedType,
                                macs: macs
                            })
                            .then((response) => {
                                if (response.result.length === 0) {
                                    $scope.insertTag.resultClass = 'background-green';
                                    $timeout(function () {
                                        $mdDialog.hide();
                                        $mdDialog.hide(registryDialog);
                                        $mdDialog.show(registryDialog);
                                    }, 1000);
                                    $scope.$apply();
                                }
                            })
                            .catch((error) => {
                                console.log('addTag error => ', error);
                            })
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
                locals             : {admin: $scope.isAdmin},
                templateUrl        : componentsPath + 'tags-table.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', 'admin', function ($scope, admin) {
                    $scope.selected = [];
                    $scope.tags     = [];
                    $scope.tagsOnline = [];
                    $scope.query    = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    socketService.sendRequest('get_all_tags', {user: dataService.username})
                        .then((response) => {
                            $scope.tags = response.result;

                            let offgridTagsIndoor  = response.result.filter(t => (t.gps_north_degree === 0 && t.gps_east_degree === 0) && (t.type_id !== 1 && t.type_id !== 14) && ((Date.now() - new Date(t.time)) > t.sleep_time_indoor));
                            let offgridTagsOutdoor = response.result.filter(t => (t.gps_north_degree !== 0 && t.gps_east_degree !== 0) && ((Date.now() - new Date(t.gps_time)) > t.sleep_time_outdoor));

                            console.log('offgridoutdoor: ', offgridTagsOutdoor);
                            console.log('offgridindoor: ', offgridTagsIndoor);
                            let offTags = response.result.filter(t => (t.type_id === 1 || t.type_id === 14) && ((t.is_exit && t.radio_switched_off) || (t.is_exit && !t.radio_switched_off)));

                            console.log('offtags: ', offTags);
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

                            $scope.tagsOnline = $scope.tags.filter(t => !tempOffgrid.some( to => to.id === t.id));
                        });

                    $scope.tagsContainTag = (tags, tag) => {
                        return tags.some(t => t.id === tag.id);
                    };

                    $scope.editCell = (event, tag, tagName) => {

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
                                    .then((response) => {
                                        if (response.result !== 1)
                                            console.log(response.result);
                                    })
                                    .catch((error) => {
                                        console.log('editCell error => ', error);
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

                    //deleting tag
                    $scope.deleteRow = (tag) => {
                        let confirm = $mdDialog.confirm()
                            .title('CANCELLAZIONE WETAG')
                            .textContent('Sei sicuro di voler cancellare l\'wetag?')
                            .targetEvent(event)
                            .multiple(true)
                            .ok('CANCELLA WETAG')
                            .cancel('ANNULLA');

                        $mdDialog.show(confirm).then(() => {
                            socketService.sendRequest('delete_tag', {tag_id: tag.id})
                                .then((response) => {
                                    if (response.result.length === 0) {
                                        $scope.tags = $scope.tags.filter(t => t.id !== tag.id);
                                    }
                                })
                                .catch((error) => {
                                    console.log('deleteRow error => ', error);
                                });
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
                            controller         : ['$scope', 'tag', function ($scope, tag) {

                                $scope.macs = [];
                                $scope.tag  = tag;

                                $scope.query = {
                                    limitOptions: [5, 10, 15],
                                    order       : 'name',
                                    limit       : 5,
                                    page        : 1
                                };

                                socketService.sendRequest('get_tag_macs', {tag: tag.id})
                                    .then((response) => {
                                        $scope.macs = response.result;
                                    })
                                    .catch((error) => {
                                        console.log('tagMacs error => ', error);
                                    });

                                //deleting a mac
                                $scope.deleteMac = (event, mac) => {
                                    let confirm = $mdDialog.confirm()
                                        .title('CANCELLAZIONE MAC')
                                        .textContent('Sei sicuro di voler cancellare il mac?.')
                                        .targetEvent(event)
                                        .multiple(true)
                                        .ok('CANCELLA MAC')
                                        .cancel('ANNULLA');

                                    $mdDialog.show(confirm).then(function () {
                                        socketService.sendRequest('delete_mac', {mac_id: mac.id})
                                            .then((response) => {
                                                if (response.result !== 0) {
                                                    $scope.macs = $scope.macs.filter(m => m.id !== mac.id);
                                                }
                                            })
                                            .catch((error) => {
                                                console.log('deleteMac error => ', error);
                                            });
                                    }, function () {
                                        console.log('CANCELLATO!!!!');
                                    });
                                };

                                //inserting a mac
                                $scope.addNewMac = () => {
                                    $mdDialog.hide();
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
                                                    socketService.sendRequest('insert_mac', {
                                                        name  : $scope.insertMac.name,
                                                        type  : $scope.insertMac.type,
                                                        tag_id: tag.id
                                                    })
                                                    .then((response) => {
                                                        if (response.result !== 0) {
                                                            $scope.insertMac.resultClass = 'background-green';
                                                            $timeout(function () {
                                                                $mdDialog.hide();
                                                                $mdDialog.show(tagMacsDialog);
                                                            }, 1000);
                                                            $scope.$apply();
                                                        } else {
                                                            $scope.insertTag.resultClass = 'background-red';
                                                        }
                                                    })
                                                    .catch((error) => {
                                                        console.log('addMac error => ', error);
                                                    })
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
                                                socketService.sendRequest('change_mac_field', {
                                                    mac_id     : mac.id,
                                                    mac_field  : macName,
                                                    field_value: input.$modelValue
                                                })
                                                .then(function (response) {
                                                    if (response.result !== 1)
                                                        console.log(response.result);
                                                })
                                                .catch((error) => {
                                                    console.log('editCell error => ', error);
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

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                    $mdDialog.show(registryDialog);
                                }
                            }]
                        };
                        $mdDialog.show(tagMacsDialog);
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            $mdDialog.show(registryDialog);
        };

        //showing the anchors table
        $scope.showAnchorsTable = function () {
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
                    };

                    $scope.searchString       = '';
                    $scope.anchorTypes        = [];
                    $scope.selectedPermitteds = [];
                    $scope.selectedNeighbors  = [];

                    socketService.sendRequest('get_anchors_by_floor_and_location', {
                        floor   : floor.name,
                        location: dataService.location
                    })
                        .then((response) => {
                            $scope.neighbors = response.result;
                            return socketService.sendRequest('get_all_tags', {})
                        })
                        .then((response) => {
                            $scope.permitteds = response.result;
                            return socketService.sendRequest('get_anchor_types', {})
                        })
                        .then((response) => {
                            $scope.anchorTypes = response.result;
                        })
                        .catch((error) => {
                            console.log('addRowDialog error => ', error);
                        });

                    $scope.updateSearch = (event) => {
                        event.stopPropagation();
                    };

                    //inserting an anchor
                    $scope.addAnchor = (form) => {
                        form.$submitted = true;

                        if (form.$valid) {
                            let neighborsString = '';
                            let permittedIds    = [];
                            $scope.neighbors.filter(a => $scope.selectedNeighbors.some(sa => sa === a.name))
                                .forEach((anchor) => {
                                    neighborsString += anchor.mac + ',';
                                });

                            neighborsString = neighborsString.replace(/,\s*$/, "");

                            $scope.permitteds = $scope.permitteds.filter(t => $scope.selectedPermitteds.some(st => st === t.name))
                                .forEach((t) => {
                                    permittedIds.push(t.id);
                                });

                            socketService.sendRequest('insert_anchor', {
                                name      : $scope.insertAnchor.name,
                                mac       : $scope.insertAnchor.mac,
                                type      : $scope.insertAnchor.selectedType,
                                ip        : $scope.insertAnchor.ip,
                                rssi      : $scope.insertAnchor.rssi,
                                proximity : $scope.insertAnchor.proximity,
                                permitteds: permittedIds,
                                neighbors : neighborsString,
                                floor     : floor.id
                            })
                            .then((response) => {
                                if (response.result.length === 0) {
                                    $scope.insertAnchor.resultClass = 'background-green';
                                    $timeout(function () {
                                        $mdDialog.hide();
                                        $mdDialog.hide(anchorsDialog);
                                        $mdDialog.show(anchorsDialog)
                                    }, 1000);
                                    $scope.$apply();
                                }
                            })
                            .catch((error) => {
                                console.log('addAnchor error => ', error);
                            })
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

                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    socketService.sendRequest('get_anchors_by_floor_and_location', {
                        floor   : floor.name,
                        location: dataService.location
                    })
                    .then((response) => {
                        $scope.anchors = response.result;
                    })
                    .catch((error) => {
                        console.log('anchorDialog error => ', error);
                    });

                    $scope.editCell = (event, anchor, anchorName) => {

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
                                    .then((response) =>  {
                                        if (response.result !== 1)
                                            console.log(response.result);
                                    })
                                    .catch((error) => {
                                        console.log('editCell error => ', error);
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

                    //inserting an anchor
                    $scope.addNewRow = () => {
                        $mdDialog.show(addRowDialog);
                    };

                    //deleting an anchor
                    $scope.deleteRow = (anchor) => {
                        let confirm = $mdDialog.confirm()
                            .title('CANCELLAZIONE ANCORA')
                            .textContent('Sei sicuro di voler cancellare l\'ancora?.')
                            .targetEvent(event)
                            .multiple(true)
                            .ok('CANCELLA ANCORA')
                            .cancel('ANNULLA');

                        $mdDialog.show(confirm).then(function () {
                            socketService.sendRequest('delete_anchor', {anchor_id: anchor.id})
                                .then((response) => {
                                    if (response.result > 0) {
                                        $scope.anchors = $scope.anchors.filter(a => a.id !== anchor.id);
                                    }
                                })
                                .catch((error) => {
                                    console.log('deleteAnchor error => ', error);
                                });
                        }, function () {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    $scope.hideAnchors = () => {
                        $mdDialog.hide();
                    };
                }]
            };
            $mdDialog.show(anchorsDialog);
        };

        //showing floors table
        $scope.floorUpdate = () => {
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

                            socketService.sendRequest('get_all_locations', {})
                                .then((response) => {
                                    currentLocation = response.result.filter(l => l.name === dataService.location)[0];

                                    if (file !== null) {
                                        socketService.sendRequest('insert_floor', {
                                            name     : $scope.insertFloor.floorName,
                                            map_image: (fileName === null) ? '' : fileName,
                                            map_width: $scope.insertFloor.mapWidth,
                                            spacing  : $scope.insertFloor.spacing,
                                            location : currentLocation.id
                                        })
                                        .then((response) => {
                                            if (response.result !== undefined && response.result !== 0) {
                                                convertImageToBase64(file)
                                                    .then((response) => {
                                                        socketService.sendRequest('save_floor_image', {
                                                            imageName: fileName,
                                                            image    : response
                                                        })
                                                        .then(function (response) {
                                                            if (response.result === false) {
                                                                $scope.insertFloor.showSuccess = false;
                                                                $scope.insertFloor.showError   = true;
                                                                $scope.insertFloor.message     = "Piano inserito senza salvare l'immagine";
                                                                $scope.insertFloor.resultClass = 'background-orange';

                                                                $scope.$apply();

                                                                $timeout(function () {
                                                                    $mdDialog.hide();
                                                                    $mdDialog.hide(floorDialog);
                                                                    $mdDialog.show(floorDialog);
                                                                }, 1000);
                                                            } else {
                                                                $scope.insertFloor.resultClass = 'background-green';
                                                                $scope.insertFloor.showSuccess = true;
                                                                $scope.insertFloor.showError   = false;
                                                                $scope.insertFloor.message     = 'Piano inserito con successo';

                                                                $scope.$apply();

                                                                $timeout(function () {
                                                                    $mdDialog.hide();
                                                                    $mdDialog.hide(floorDialog);
                                                                    $mdDialog.show(floorDialog);
                                                                }, 1000);
                                                            }
                                                        })
                                                        .catch((error) => {
                                                            console.log('insertFloor error => ', error);
                                                        })
                                                });
                                            } else {
                                                $scope.insertFloor.showSuccess = false;
                                                $scope.insertFloor.showError   = true;
                                                $scope.insertFloor.message     = 'Impossibile inserire il piano.';
                                                $scope.insertFloor.resultClass = 'background-red';
                                            }
                                        })
                                        .catch((error) => {
                                            console.log('insertFloor error => ', error);
                                        })
                                    } else {
                                        $scope.insertFloor.showSuccess = false;
                                        $scope.insertFloor.showError   = true;
                                        $scope.insertFloor.message     = 'Selezionare un file per il piano.';
                                        $scope.insertFloor.resultClass = 'background-red';
                                    }
                                })
                                .catch(function () {
                                    $scope.insertFloor.showSuccess = false;
                                    $scope.insertFloor.showError   = true;
                                    $scope.insertFloor.message     = 'Impossibile inserire il piano';
                                    $scope.insertFloor.resultClass = 'background-red';
                                });
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

                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    socketService.sendRequest('get_floors_by_location', {location: dataService.location})
                        .then((response) => {
                            $scope.floors = response.result;
                        });

                    $scope.editCell = (event, floor, floorName) => {

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
                                    .then((response) => {
                                        if (response.result !== 1)
                                            console.log(response.result);
                                    })
                                    .catch((error) => {
                                        console.log('editCell error => ', error);
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

                    //inserting a new floor
                    $scope.addNewRow = () => {
                        $mdDialog.show(addRowDialog);
                    };

                    //deleting a floor
                    $scope.deleteRow = (floor) => {
                        let confirm = $mdDialog.confirm()
                            .title('CANCELLAZIONE PIANO')
                            .textContent('Sei sicuro di voler cancellare il piano?.')
                            .targetEvent(event)
                            .multiple(true)
                            .ok('CANCELLA PIANO')
                            .cancel('ANNULLA');

                        $mdDialog.show(confirm).then(function () {
                            if ($scope.floors.length > 1) {
                                socketService.sendRequest('delete_floor', {floor_id: floor.id})
                                    .then((response) => {
                                        if (response.result > 0) {
                                            $scope.floors = $scope.floors.filter(a => a.id !== floor.id);
                                        }
                                    })
                                    .catch((error) => {
                                        console.log('deleteRow error => ', error);
                                    });
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

                    $scope.fileNameChanged = () =>  {
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
                                    return socketService.sendRequest('save_floor_image', {
                                        id   : $scope.floorId,
                                        image: result,
                                        name : fileName
                                    })
                                })
                                .then((response) => {
                                    console.log(response);
                                })
                                .catch((error) => {
                                    console.log('fileNameChanged error => ', error);
                                })
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            $mdDialog.show(floorDialog);
        };

        $scope.quickActions = () => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'quick-actions-dialog.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller: ['$scope', '$interval', 'dataService', function ($scope, $interval, dataService) {

                    dataService.loadUserSettings();

                    $scope.switch = {
                        showGrid: true,
                        showAnchors: true,
                        showCameras: true
                    };

                    $scope.updateUserSettings = () => {
                        dataService.updateUserSettings();
                    };

                    $scope.$watchGroup(['switch.showGrid', "switch.showAnchors", 'switch.showCameras'], function (newValues) {
                        console.log('watching');
                        dataService.switch.showGrid = (newValues[0]);
                        dataService.switch.showAnchors = (newValues[1]);
                        dataService.switch.showCameras = (newValues[2]);
                    })
                }]
            });
        };

        //function that makes the logout of the user
        $scope.logout = () => {
            socketService.sendRequest('logout', {})
                .then((response) => {
                    if (response.result === 'logged_out')
                        $state.go('login');
                })
                .catch((error) => {
                    console.log('logout error => ', error);
                })
        };

        //handeling search tags functionality
        $scope.$watch('selectedTag', function (newValue) {
            let newStringValue = "" + newValue;
            if (newStringValue !== '') {
                socketService.sendRequest('get_all_tags', {})
                    .then((response) => {
                        let newTag = $filter('filter')(response.result, newValue)[0];
                        if (newTag.gps_north_degree === 0 && newTag.gps_east_degree === 0) {
                            //TODO mostrare tag su canvas
                            $mdDialog.show({
                                locals             : {tags: response.result, outerScope: $scope},
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
                                    }, 0);

                                    socketService.sendRequest('get_tag_floor', {tag: newTag.id})
                                        .then((response) => {
                                            $scope.floorData.location  = response.result.location_name;
                                            $scope.floorData.floorName = response.result.name;

                                            let img = new Image();
                                            img.src = imagePath + 'floors/' + response.result.image_map;

                                            img.onload = function () {
                                                canvas.width  = this.naturalWidth;
                                                canvas.height = this.naturalHeight;

                                                //updating the canvas and drawing border
                                                updateCanvas(canvas.width, canvas.height, context, img);

                                                let tagImg = new Image();
                                                tagImg.src = imagePath + 'icons/tags/online_tag_24.png';

                                                tagImg.onload = function () {
                                                    drawIcon(newTag, context, tagImg, response.result.width, canvas.width, canvas.height, true);
                                                }
                                            };
                                        })
                                        .catch((error) => {
                                            console.log('watchSelectedTag error => ', error);
                                        });

                                    $scope.hide = () => {
                                        outerScope.selectedTag = '';
                                        $mdDialog.hide();
                                    }
                                }]
                            })

                        } else {
                            $mdDialog.show({
                                locals             : {tagName: newValue, outerScope: $scope},
                                templateUrl        : componentsPath + 'search-tag-outside.html',
                                parent             : angular.element(document.body),
                                targetEvent        : event,
                                clickOutsideToClose: true,
                                controller         : ['$scope', 'NgMap', 'tagName', 'outerScope', 'socketService', function ($scope, NgMap, tagName, outerScope, socketService) {

                                    let tag             = null;
                                    $scope.locationName = '';

                                    $scope.mapConfiguration = {
                                        zoom    : 8,
                                        map_type: mapType,
                                    };

                                    socketService.sendRequest('get_all_tags', {})
                                        .then((response) => {
                                            tag = response.result.filter(t => t.name === tagName)[0];

                                            return socketService.sendRequest('get_all_locations', {});
                                        })
                                        .then((response) => {
                                            let locations = response.result;


                                            locations.forEach((location) => {
                                                if ((dataService.getTagDistanceFromLocationOrigin(tag, [location.latitude, location.longitude])) <= location.radius) {
                                                    $scope.locationName = location.name;
                                                }
                                            });
                                        })
                                        .catch((error) => {
                                            console.log('watchSelectedTag error => ', error);
                                        });

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
                                        outerScope.selectedTag = '';
                                        $mdDialog.hide();
                                    }
                                }]
                            })
                        }
                    })
                    .catch((error) => {
                        console.log('watchSelectedTag error => ', error);
                    })
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
