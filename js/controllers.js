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
            socketService.getSocket('login', {username: $scope.user.username, password: $scope.user.password}).then(
                function (message) {
                    let mess = JSON.parse(message.data);

                    if (mess.result !== "ERROR_ON_LOGIN") {
                        console.log(mess.result);
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
            $location.path('/recover-password');
        }
    }

    /**
     * Function that manges the home page functionalities
     * @type {string[]}
     */
    homeController.$inject = ['$scope', '$state', 'NgMap', 'homeData', 'socketService', 'dataService'];
    function homeController($scope, $state, NgMap, homeData, socketService, dataService) {

        let homeCtrl         = this;
        let markers    = homeData.markers;
        let bounds = null;

        homeCtrl.isAdmin = (homeData.isAdmin === 1);

        homeCtrl.mapConfiguration = {
            zoom    : 7,
            map_type: 'TERRAIN',
            center  : [41.87194, 12.56738]
        };

        homeCtrl.dynamicMarkers = [];

        NgMap.getMap('main-map').then(function (map) {

            let hideStyles =  [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [
                        { visibility: "off" }
                    ]
                },{
                    featureType: "water",
                    elementType: "labels",
                    stylers: [
                        { visibility: "off" }
                    ]
                },{
                    featureType: "road",
                    elementType: "labels",
                    stylers: [
                        { visibility: "off" }
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
                    position: latLng,
                    animation: google.maps.Animation.DROP,
                    icon    : '../img/icons/markers/' + ((markers[i].icon) ? markers[i].icon : 'location-marker.png')
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
                    socketService.getSocket('save_location', {location: markers[i].name})
                        .then(function (result) {
                            let message = JSON.parse(result.data);
                            if (message.result === 'location_saved') {
                                socketService.getSocket('get_location_info', {})
                                    .then(function (response) {
                                        let mess = JSON.parse(response.data);
                                        dataService.location = mess.result;

                                        if (mess.result.is_inside)
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
        let outdoorCtrl = this;
        let userTags = outdoorData.tags;
        let tags = null;
        let updateMapTimer = null;
        let bounds = new google.maps.LatLngBounds();
        let locationInfo = '';

        outdoorCtrl.isAdmin = outdoorData.isAdmin;

        outdoorCtrl.mapConfiguration = {
            zoom    : 7,
            map_type: 'TERRAIN',
            center  : [41.87194, 12.56738]
        };

        let dynamicTags = [];

        NgMap.getMap('outdoor-map').then(function (map) {
            let hideStyles =  [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [
                        { visibility: "off" }
                    ]
                },{
                    featureType: "water",
                    elementType: "labels",
                    stylers: [
                        { visibility: "off" }
                    ]
                },{
                    featureType: "road",
                    elementType: "labels",
                    stylers: [
                        { visibility: "off" }
                    ]
                }
            ];

            map.set('styles', hideStyles);

            socketService.getSocket('get_location_info', {})
                .then(function (response) {
                    let message = JSON.parse(response.data);
                    locationInfo = message.result[0].name;
                    console.log(locationInfo);

                    return socketService.getSocket('get_tags_by_location', {location: locationInfo})
                })
                .then(function (response) {
                    let message = JSON.parse(response.data);
                    tags = message.result;

                    console.log(tags);

                    for (let i = 0; i < tags.length; i++) {
                        let latLng = new google.maps.LatLng(tags[i].gps_north_degree, tags[i].gps_east_degree);
                        let marker = new google.maps.Marker({
                            position: latLng,
                            animation: google.maps.Animation.DROP,
                            icon    : '../img/icons/tags/tag-online-48.png'
                        });

                        let infoContent ='<div class="marker-info-container">' +
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
                        }else {
                            if (checkAlarms(tags[i])){
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
                    }else {
                        console.log(dataService.location);
                        let latLng = new google.maps.LatLng(dataService.location.latitude, dataService.location.longitude);
                        console.log(latLng);
                        map.setCenter(latLng);
                        map.setZoom(10)
                    }

                    constantUpdateMapTags(map, bounds);
                })
        });


        let constantUpdateMapTags = function(map, bounds){
            updateMapTimer = $interval(function () {
                socketService.getSocket('get_tags_by_location', {location: locationInfo})
                    .then(function (response) {
                        let mess = JSON.parse(response.data);
                        tags = mess.result;
                        console.log(tags);
                        for (let i = 0; i < tags.length; i++) {
                            let latLng = new google.maps.LatLng(tags[i].gps_north_degree, tags[i].gps_east_degree);

                            let marker = new google.maps.Marker({
                                position: latLng,
                                animation: google.maps.Animation.DROP,
                                icon    : '../img/icons/tags/tag-online-48.png'
                            });

                            let infoContent ='<div class="marker-info-container">' +
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

                                if (checkAlarms(tags[i])){
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
                                }else {
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
                                    }else {
                                        dynamicTags.push(marker);
                                        marker.setMap(map);
                                    }
                                }
                            }else if (isOutdoor(tags[i])) {
                                console.log('show marker not');
                                if (checkAlarms(tags[i])){
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
                                        for(let m = 0; m < dynamicTags.length; m++){
                                            if (dynamicTags[m].getPosition().equals(marker.getPosition())) {
                                                if (marker.getIcon() !== dynamicTags[m].getIcon()){
                                                    dynamicTags[m].setMap(null);
                                                    dynamicTags.splice(m, 1);
                                                }
                                            }
                                        }
                                    }else {
                                        console.log('pushing marker');
                                        dynamicTags.push(marker);
                                        marker.setMap(map);
                                        bounds.extend(marker.getPosition());
                                    }
                                }else{
                                    for(let m = 0; m < dynamicTags.length; m++){
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

        let setIcon = function(tag, marker){
            if (tag.sos){
                marker.setIcon('../img/icons/tags/sos.png');
            }else if (tag.battery_status){
                marker.setIcon('../img/icons/tags/battery-empty.png');
            } else if (tag.man_down){
                marker.setIcon('../img/icons/tags/man-down.png');
            } else if (tag.man_down_disabled){
                marker.setIcon('../img/icons/tags/man-down-disabled.png');
            }else if (tag.man_down_tacitated){
                marker.setIcon('../img/icons/tags/man-down-tacitated.png');
            } else if(tag.man_in_quote){
                marker.setIcon('../img/icons/tags/man-in-quote.png');
            }else if(tag.call_me_alarm){
                marker.setIcon('../img/icons/tags/call-me.png');
            }else if (tag.diagnostic_request){
                marker.setIcon('../img/icons/tags/diagnostic-request.png');
            }
        };

        let markerIsOnMap = function(markers, marker){
            for(let m = 0; m < markers.length; m++){
                if (markers[m].getPosition().equals(marker.getPosition()))
                    return true;
            }
            return false;
        };

        let isOutdoor = function(tag){
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

        $scope.showAlarms = function(){
            $mdDialog.show({
                locals: {tags: tags},
                templateUrl        : '../components/outdoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'tags', function ($scope, tags) {
                    $scope.alarms = {};

                    for (let i = 0; i < tags.length; i++){
                        if (tags[i].sos){
                            $scope.alarms['sos_' + tags[i].name] = {tag: tags[i].name, name: 'SOS', description: 'Richiesta di aiuto immediato.', image: '../img/icons/tags/sos.png'};
                        }
                        if (tags[i].battery_status){
                            $scope.alarms['battery_status_' + tags[i].name] = {tag: tags[i].name, name: 'Batteria scarica', description: 'La batteria e\' scarica.', image: '../img/icons/tags/battery-empty.png'};
                        }
                        if (tags[i].man_down){
                            $scope.alarms['man_down_' + tags[i].name] = {tag: tags[i].name, name: 'Uomo a terra', description: 'Uomo a terra, mandare soccorso', image: '../img/icons/tags/man-down.png'};
                        }
                        if (tags[i].man_down_disabled){
                            $scope.alarms['man_down_disabled_' + tags[i].name] = {tag: tags[i].name, name: 'Uomo a terra disabilitato', description: 'Uomo a terra disabilitato', image: '../img/icons/tags/man-down-disabled.png'};
                        }
                        if (tags[i].man_down_tacitated){
                            $scope.alarms['man_down_tacitated_' + tags[i].name] = {tag: tags[i].name, name: 'Man down tacitated', description: 'Man down tacitated.', image: '../img/icons/tags/man-down-tacitated.png'};
                        }
                        if(tags[i].man_in_quote){
                            $scope.alarms['man_in_quote' + tags[i].name] = {tag: tags[i].name, name: 'Man in quote', description: 'Man in quote.', image: '../img/icons/tags/man-in-quote.png'};
                        }
                        if(tags[i].call_me_alarm){
                            $scope.alarms['call_me_alarm_' + tags[i].name] = {tag: tags[i].name, name: 'Call_me_alarm', description: 'Call me alarm.', image: '../img/icons/tags/call-me-alarm.png'};
                        }
                        if (tags[i].diagnostic_request){
                            $scope.alarms['diagnostic_request' + tags[i].name] = {tag: tags[i].name, name: 'Diagnostic request', description: 'Diagnostic request.', image: '../img/icons/tags/diagnostic-request.png'};
                        }
                    }

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        $scope.showOfflineTags = function(){
            console.log('offline tags clicked');
            $mdDialog.show({
                locals: {tags: tags},
                templateUrl        : '../components/show-offline-tags.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'tags', function ($scope, tags) {

                    $scope.offlineTags = {};

                    for (let i = 0; i < tags.length; i++){
                        if ((tags[i].gps_north_degree !== 0 && tags[i].gps_east_degree !== 0) && (new Date(Date.now()) - (new Date(tags[i].gps_time)) > tags[i].sleep_time_outdoor)){
                            $scope.offlineTags[tags[i].name] = {name: tags[i].name, image: '../img/icons/tags/tag-offline.png'}
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
        let canvas  = document.querySelector('#canvas-id');
        let context = canvas.getContext('2d');let canvasCtrl = this;
        let bufferCanvas  = document.createElement('canvas');
        let bufferContext = bufferCanvas.getContext('2d');
        let img = new Image();
        let interval = undefined;

        canvasCtrl.tags = null;
        canvasCtrl.floors       = canvasData.floors;
        canvasCtrl.defaultFloor = canvasCtrl.floors[0];
        canvasCtrl.showAlarmsIcon         = false;
        canvasCtrl.showOfflineTagsIcon    = false;
        canvasCtrl.showOfflineAnchorsIcon = false;

        //floor initial data
        canvasCtrl.floorData = {
            defaultFloorName: canvasData.floors[0].name,
            gridSpacing     : canvasData.floors[0].map_spacing,
            location        : canvasData.location,
        };

        //canvas show/hide elements variable
        canvasCtrl.switch = {
            showGrid      : true,
            showAnchors   : true,
            showCameras   : true,
            showRadius    : true,
            showDrawing   : false,
            showFullscreen: false,
        };

        //setting for the drawing on canvas functionality
        canvasCtrl.drawingOnCanvasSetting = {
            isOpen           : false,
            selectedDirection: 'left',
            mode             : 'md-scale',
            drawingMode      : ''
        };




        //watching for changes in switch buttons in menu
        $scope.$watchGroup(['canvasCtrl.switch.showGrid', 'canvasCtrl.switch.showAnchors', 'canvasCtrl.switch.showCameras', 'canvasCtrl.floorData.gridSpacing', 'canvasController.switch.showDrawing'], function (newValues) {
            //control if spacing is changed
            if (canvasCtrl.defaultFloor.map_spacing !== newValues[3])
                canvasCtrl.defaultFloor.map_spacing = newValues[3];

            //TODO - control if drawing is off, - control if interval is undefined and start it if so, - resetting the switch buttons
            //     - if drawing is on stop the interval and set it to undefined, - reset the switch buttons, - reload canvas

            canvasCtrl.loadFloor();
        });

        $scope.$watch('switch.fullscreen', function (newValue) {
            if (newValue) {
                openFullScreen(document.querySelector('#canvas-container'));
                $scope.switch.fullscreen = false;
            }
        });

        $scope.$watch('canvasCtrl.floorData.defaultFloorName', function (newValue) {
            console.log(newValue);
            canvasCtrl.defaultFloor = canvasCtrl.floors.filter(f => {
                return f.name === newValue
            })[0];

            // if (canvasCtrl.floorData.gridSpacing === canvasCtrl.defaultFloor.map_spacing)
            //     canvasCtrl.loadFloor(true, true, true);
            // else
            //     canvasCtrl.floorData.gridSpacing = canvasCtrl.defaultFloor.map_spacing;
        });

        canvasCtrl.loadFloor = function () {
            let img = new Image();
            img.src = imagePath + 'floors/' + canvasCtrl.defaultFloor.image_map;

            img.onload = function () {
                canvas.width  = this.naturalWidth;
                canvas.height = this.naturalHeight;

                if (interval !== undefined){
                    $interval.cancel(interval);
                    interval = undefined;
                }

                $interval(constantUpdateCanvas, 1000);
                // constantUpdateCanvas();
            };
        };

        let constantUpdateCanvas = function () {
            img.src = imagePath + 'floors/' + canvasCtrl.defaultFloor.image_map;
            img.onload = function () {
                bufferCanvas.width  = this.naturalWidth;
                bufferCanvas.height = this.naturalHeight;

                //updating the canvas and drawing border
                updateCanvas(bufferCanvas.width, bufferCanvas.height, bufferContext, img);

                if (canvasCtrl.switch.showGrid) {
                    //drawing vertical
                    drawDashedLine(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasCtrl.defaultFloor.map_spacing, canvasCtrl.defaultFloor.width, 'vertical');
                    //drawing horizontal lines
                    drawDashedLine(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasCtrl.defaultFloor.map_spacing, canvasCtrl.defaultFloor.width, 'horizontal');
                }

                socketService.getSocket('get_anchors_by_floor_and_location', {floor: canvasCtrl.floorData.defaultFloorName, location: dataService.location.name})
                    .then(function (response) {
                        let message         = JSON.parse(response.data);
                        dataService.anchors = message.result;

                        $scope.showAnchorsOfflineIcon = checkOfflineAnchors(dataService.anchors);

                        if (canvasCtrl.switch.showAnchors) {
                            let i = 0;
                            promiseLoadImages(message.result, 'anchor').then(
                                function (allImages) {
                                    angular.forEach(allImages, function (img) {
                                        drawIcon(message.result[i++], bufferContext, img, canvasCtrl.defaultFloor.width, bufferCanvas, false);
                                    })
                                }
                            )
                        }

                        return socketService.getSocket('get_cameras', {floor: canvasCtrl.floorData.defaultFloorName})
                    })
                    .then(function (response) {
                        let message = JSON.parse(response.data);

                        dataService.cameras = message.result;

                        if (canvasCtrl.switch.showCameras) {
                            let i = 0;
                            promiseLoadImages(message.result, 'camera').then(
                                function (allImages) {
                                    angular.forEach(allImages, function (img) {
                                        drawIcon(message.result[i++], bufferContext, img, canvasCtrl.defaultFloor.width, bufferCanvas, false);
                                    })
                                }
                            )
                        }
                        return socketService.getSocket('get_tags_by_floor', {floor: canvasCtrl.defaultFloor.id});
                    })
                    .then(function (response) {
                        let message = JSON.parse(response.data);
                        $scope.tags = message.result;

                        canvasCtrl.showAlarmsIcon = checkAlarms($scope.tags);


                        let i       = 0;
                        promiseLoadImages(message.result, 'tag').then(
                            function (allImages) {
                                angular.forEach(allImages, function (img) {
                                    if(!(message.result[i].is_exit && message.result[i].radio_switched_off))
                                        drawIcon(message.result[i], bufferContext, img, canvasCtrl.defaultFloor.width, bufferCanvas, true);
                                    i++;
                                });

                                context.drawImage(bufferCanvas, 0, 0);
                            }
                        );
                        console.log(isTagOffline(message.result));
                        canvasCtrl.showOfflineTagsIcon = isTagOffline(message.result);
                    })
            }
        };

        let showAnchors = function (result) {
            let img = new Image();
            if (result.is_online)
                img.src = imagePath + 'icons/ancor-online-icon.png';
            else
                img.src = imagePath + 'icons/anchor-offline-icon.png';
            img.onload = function () {
                drawIcon(result, context, img, canvasCtrl.defaultFloor.width, canvas, false);
            };
        };


        let showCameras = function (result) {
            let img = new Image();
            img.src = imagePath + 'icons/camera-online-icon.png';

            img.onload = function () {
                console.log(result);
                drawIcon(result, context, img, canvasCtrl.defaultFloor.width, canvas, false);
            };
        };

        let showWeTag = function (result) {
            let img = new Image();
            img.src = imagePath + 'icons/tag-online.png';

            img.onload = function () {
                drawIcon(result, context, img, canvasCtrl.defaultFloor.width, canvas, true);
            }
        };

        let controllAlarmOk = function (tag, image) {

            if (tag.sos) {
                image.src = imagePath + 'icons/tags/sos.png';
            }else if (tag.battery_status) {
                image.src = imagePath + 'icons/tags/battery-empty.png';
            } else if (tag.man_down) {
                image.src = imagePath + 'icons/tags/man-down.png';
            } else if (tag.man_down_disabled) {
                image.src = imagePath + 'icons/tags/man-down-disabled.png';
            } else if (tag.man_down_tacitated) {
                image.src = imagePath + 'icons/tags/man-down-tacitated.png';
            } else if (tag.man_in_quote) {
                image.src = imagePath + 'icons/tags/man-in-quote.png';
            } else if (tag.call_me_alarm) {
                image.src = imagePath + 'icons/tags/call-me-alarm.png';
            } else if (tag.helmet_dpi) {
                image.src = imagePath + 'icons/man-down-icon.png';
            } else if (tag.belt_dpi) {
                image.src = imagePath + 'icons/man-down-icon.png';
            } else if (tag.glove_dpi) {
                image.src = imagePath + 'icons/man-down-icon.png';
            } else if (tag.shoe_dpi) {
                image.src = imagePath + 'icons/man-down-icon.png';
            } else {
                image.src = imagePath + 'icons/tags/tag-online.png';
            }
        };

        let promiseLoadImages = function (data, image) {
            return Promise.all(
                data.map(function (value) {
                    return new Promise(function (resolve) {
                        let img = new Image();
                        if ((image === 'anchor' || image === 'camera') && value.is_online === 1)
                            img.src = imagePath + 'icons/' + image + '-online-icon.png';
                        else if (image === 'anchor' || image === 'camera')
                            img.src = imagePath + 'icons/' + image + '-offline-icon.png';
                        else if (image === 'tag')
                            if (value.is_exit && !value.switched_off){
                                img.src = imagePath + 'icons/tags/tag-offline1.png';
                            }else if(!value.is_exit && !value.switched_off) {
                                controllAlarmOk(value, img);
                            }

                        img.onload = function () {
                            resolve(img);
                        }
                    })
                })
            )
        };


        let checkAlarms = function (tags) {
            let result = false;
            for (let i = 0; i < tags.length; i++){
                if (tags[i].battery_status || tags[i].man_down || tags[i].man_down_disabled || tags[i].man_down_tacitated || tags[i].man_in_quote || tags[i].call_me_alarm
                    || tags[i].diagnostic_request)
                    result = true;
            }
            return result;
        };

        let checkOfflineAnchors = function(anchors){
            let result = false;
            for (let i = 0; i < anchors.length; i++){
                if (anchors[i].is_online)
                    result = true;
            }
            return result;
        }



        let isTagOffline = function(tags){
            let result = false;

            for (let i = 0; i < tags.length; i++){
                if (tags[i].is_exit && !tags[i].radio_switched_off)
                    result = true;
            }

            return result;
        };

        // constantUpdateCanvas();
        HTMLCanvasElement.prototype.relMouseCoords = function (event) {
            var totalOffsetX = 0;
            var totalOffsetY = 0;
            var canvasX = 0;
            var canvasY = 0;
            var currentElement = this;

            do {
                totalOffsetX += currentElement.offsetLeft;
                totalOffsetY += currentElement.offsetTop;
            }
            while (currentElement = currentElement.offsetParent)

            canvasX = event.pageX - totalOffsetX;
            canvasY = event.pageY - totalOffsetY;

            // Fix for variable canvas width
            canvasX = Math.round( canvasX * (this.width / this.offsetWidth) );
            canvasY = Math.round( canvasY * (this.height / this.offsetHeight) );

            return {x:canvasX, y:canvasY}
        }

        canvas.addEventListener('mousedown', function (event) {
            let coords = canvas.relMouseCoords(event);
            let tags = $scope.tags;
            console.log(tags);
            let anchors = dataService.anchors;
            let cameras = dataService.cameras;

            for (let i = 0; i < tags.length; i++){
                if (tags[i].gps_north_degree === 0 || tags[i].gps_east_degree === 0){
                    if (((tags[i].x_pos - 20) < coords.x && coords.x < (tags[i].x_pos + 20)) && ((tags[i].y_pos - 20) < coords.y && coords.y < (tags[i].y_pos + 20) )) {
                        $mdDialog.show({
                            locals: {tag: tags[i]},
                            templateUrl        : '../components/tag-info.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            controller         : ['$scope', 'tag', function ($scope, tag) {
                                $scope.tag = tag;
                                $scope.isAlarm = 'background-red';
                                $scope.alarms = {};

                                if (tag.battery_status){
                                    $scope.alarms['battery_status_' + tags[i].name] = {tag: tags[i].name, name: 'Batteria scarica', description: 'La batteria e\' scarica.', image: '../img/icons/battery-empty.png'};
                                }
                                if (tag.man_down){
                                    $scope.alarms['man_down_' + tags[i].name] = {tag: tags[i].name, name: 'Uomo a terra', description: 'Uomo a terra, mandare soccorso', image: '../img/icons/man-down-icon.png'};
                                }
                                if (tag.man_down_tacitated){
                                    $scope.alarms.man_down_tacitated = true;
                                }
                                if(tag.man_in_quote){
                                    $scope.alarms.man_in_quote = true;
                                }
                                if(tag.call_me_alarm){
                                    $scope.alarms.call_me_alarm = true;
                                }
                                if (tag.diagnostic_request){
                                    $scope.alarms.diagnostic_request = true;
                                }

                                console.log($scope.alarms);
                                if (angular.equals({}, $scope.alarms)){
                                    if ($scope.tag.is_exit && !$scope.tag.radio_switched_off){
                                        $scope.isAlarm = 'background-gray';
                                    } else {
                                        $scope.isAlarm = 'background-green';
                                        console.log($scope.isAlarm);
                                    }
                                }
                                console.log(tag);
                                $scope.hide = function () {
                                    $mdDialog.hide();
                                }
                            }]
                        })
                    }
                }
            }

            for (let i = 0; i < anchors.length; i++){
                if (((anchors[i].x_pos - 20) < coords.x && coords.x < (anchors[i].x_pos + 20)) && ((anchors[i].y_pos - 20) < coords.y && coords.y < (anchors[i].y_pos + 20) )) {
                    $mdDialog.show({
                        locals: {anchor: anchors[i]},
                        templateUrl        : '../components/anchor-info.html',
                        parent             : angular.element(document.body),
                        targetEvent        : event,
                        clickOutsideToClose: true,
                        controller         : ['$scope', 'anchor', function ($scope, anchor) {
                            $scope.anchor = anchor;
                            $scope.isOnline = 'background-green';

                            if (!anchor.is_online){
                                $scope.isOnline = 'background-gray';
                            }
                            console.log(anchor);
                            $scope.hide = function () {
                                $mdDialog.hide();
                            }
                        }]
                    })
                }
            }

            console.log(cameras);
            for (let i = 0; i < cameras.length; i++){
                if (((cameras[i].x_pos - 20) < coords.x && coords.x < (cameras[i].x_pos + 20)) && ((cameras[i].y_pos - 20) < coords.y && coords.y < (cameras[i].y_pos + 20) )) {
                    console.log(cameras[i].description);
                }
            }
        }, false);

        $scope.showAlarms = function () {
            $mdDialog.show({
                locals: {tags: $scope.tags},
                templateUrl        : '../components/indoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'tags', function ($scope, tags) {
                    $scope.alarms = {};

                    for (let i = 0; i < tags.length; i++) {
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
                        if (tags[i].man_down_tacitated) {
                            $scope.alarms.man_down_tacitated = true;
                        }
                        if (tags[i].man_in_quote) {
                            $scope.alarms.man_in_quote = true;
                        }
                        if (tags[i].call_me_alarm) {
                            $scope.alarms.call_me_alarm = true;
                        }
                        if (tags[i].diagnostic_request) {
                            $scope.alarms.diagnostic_request = true;
                        }
                    }

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        }

        $scope.showOfflineTagsIndoor = function(){
            console.log('offline tags clicked');
            $mdDialog.show({
                locals: {tags: $scope.tags},
                templateUrl        : '../components/show-offline-tags.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'tags', function ($scope, tags) {

                    $scope.offlineTags = {};

                    for (let i = 0; i < tags.length; i++){
                        if (tags[i].is_exit && !tags[i].radio_switched_off){
                            $scope.offlineTags[tags[i].name] = {name: tags[i].name, image: '../img/icons/tags/tag-offline1.png'}
                        }
                    }

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        $scope.showEmergencyZone = function () {
            $mdDialog.show({
                locals: {floor: canvasCtrl.defaultFloor.name, tags: $scope.tags},
                templateUrl        : '../components/emergency-alarm-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'floor', 'tags', function ($scope, floor, tags) {
                    $scope.safeTags = null;
                    $scope.unsafeTags = [];

                    $scope.men = {
                        safe: 0,
                        unsafe: 0
                    };
                    $scope.colors = ["#4BAE5A", "#E13044"];
                    $scope.labels = ["Persone in zona di evacuazione", "Persone disperse"];

                    socketService.getSocket('get_emergency_info', {location: dataService.location, floor: floor})
                        .then(function (response) {
                            let message = JSON.parse(response.data);
                            $scope.safeTags = message.result;
                            $scope.unsafeTags = tags.filter(t => !message.result.some(i => i.tag_name === t.name));

                            $scope.men.safe = message.result.length;
                            $scope.men.unsafe = tags.length - message.result.length;

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

        let searchMarker = new google.maps.Marker({});
        $scope.isAdmin = dataService.isAdmin;
        $scope.tags = dataService.tags;
        $scope.selectedTag = '';
        $scope.switch = {
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

                            socketService.getSocket('get_user', {})
                                .then(
                                    function (response) {
                                        let user = JSON.parse(response.data);

                                        return socketService.getSocket('insert_location', {
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
                                        return socketService.getSocket('save_marker_image', {
                                            imageName: fileName,
                                            image: result
                                        })
                                    })
                                .then(function (result) {
                                        let message = JSON.parse(result.data);

                                        if (message.result === false) {
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

                        socketService.getSocket('get_events', {})
                            .then(function (response) {
                                console.log(response);
                                let message           = JSON.parse(response.data);
                                $scope.history.events = message.result;
                                $scope.history.tags   = dataService.tags;
                                $scope.$apply();
                                return socketService.getSocket('get_history', {
                                    fromDate: fromDate,
                                    toDate  : toDate,
                                    tag     : newValues[2],
                                    event   : newValues[3]
                                })
                            })
                            .then(function (result) {
                                    let mess           = JSON.parse(result.data);
                                    $scope.historyRows = mess.result;

                                    if ($scope.historyRows.length === 0){
                                        $scope.tableEmpty = true;
                                    }else {
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

                                socketService.getSocket('change_password', {
                                    oldPassword: $scope.changePassword.oldPassword,
                                    newPassword: $scope.changePassword.newPassword
                                })
                                    .then(function (result) {
                                        let message = JSON.parse(result.data);
                                        if (message.result === 'wrong_old') {
                                            $scope.changePassword.resultClass = 'background-red';
                                            $scope.changePassword.showError   = true;
                                            $scope.changePassword.showSuccess = false;
                                            $scope.changePassword.message     = 'Vecchia password non valida';
                                        } else if (message.result === 'error_on_changing_password') {
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
                locals: {admin: $scope.isAdmin},
                templateUrl        : '../components/change-registry.html',
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

                    socketService.getSocket('get_tags_by_location', {location: dataService.location})
                        .then(function (response) {
                            let message = JSON.parse(response.data);
                            $scope.tags = message.result;
                        });

                    $scope.editCell = function (event, tag, tagName) {

                        event.stopPropagation();

                        if(admin) {
                            let editCell = {
                                modelValue : tag[tagName],
                                save       : function (input) {
                                    input.$invalid = true;
                                    tag[tagName]   = input.$modelValue;
                                    socketService.getSocket('change_tag_field', {
                                        tag_id     : tag.id,
                                        tag_field  : tagName,
                                        field_value: input.$modelValue
                                    })
                                        .then(function (response) {
                                            let message = JSON.parse(response.data);
                                            if (message.result !== 1)
                                                console.log(message.result);
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
                locals: {admin: $scope.isAdmin},
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

                    socketService.getSocket('get_anchors_by_location', {location: dataService.location})
                        .then(function (response) {
                            let message    = JSON.parse(response.data);
                            $scope.anchors = message.result;
                        });

                    $scope.editCell = function (event, anchor, anchorName) {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue : anchor[anchorName],
                                save       : function (input) {
                                    input.$invalid     = true;
                                    anchor[anchorName] = input.$modelValue;
                                    socketService.getSocket('change_anchor_field', {
                                        anchor_id   : anchor.id,
                                        anchor_field: anchorName,
                                        field_value : input.$modelValue
                                    })
                                        .then(function (response) {
                                            let message = JSON.parse(response.data);
                                            if (message.result !== 1)
                                                console.log(message.result);
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
                locals: {admin: $scope.isAdmin},
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

                    canvasCtrl.floors = dataService.floors;

                    $scope.editCell = function (event, floor, floorName) {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue : floor[floorName],
                                save       : function (input) {
                                    input.$invalid   = true;
                                    floor[floorName] = input.$modelValue;
                                    console.log(floorName);
                                    socketService.getSocket('change_floor_field', {
                                        floor_id   : floor.id,
                                        floor_field: floorName,
                                        field_value: input.$modelValue
                                    })
                                        .then(function (response) {
                                            let message = JSON.parse(response.data);
                                            if (message.result !== 1)
                                                console.log(message.result);
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
                                    return socketService.getSocket('save_floor_image', {
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
            socketService.getSocket('logout', {}).then(
                function (result) {
                    let mess = JSON.parse(result.data);
                    if (mess.result === 'logged_out')
                        $state.go('login');
                }
            )
        };

        $scope.$watch('selectedTag', function (newValue, oldValue) {
            console.log(newValue);
            if (newValue !== '') {
                let newTag = $filter('filter')(dataService.tags, newValue)[0];
                let oldTag = $filter('filter')(dataService.tags, oldValue)[0];
                console.log(newTag);
                if (newTag.gps_north_degree === 0 && newTag.gps_east_degree === 0){
                    //TODO mostrare tag su canvas
                    $mdDialog.show({
                        locals: {tags: $scope.tags, outerScope: $scope},
                        templateUrl        : '../components/search-tag-inside.html',
                        parent             : angular.element(document.body),
                        targetEvent        : event,
                        clickOutsideToClose: true,
                        controller         : ['$scope', 'tags', 'outerScope', 'socketService', function ($scope, tags, outerScope, socketService) {
                            let canvas = null;
                            let context = null;
                            let tag = tags.find(x => x.name === newValue);
                            console.log(tag);

                            canvasCtrl.floorData = {
                                location: '',
                                floorName: ''
                            };

                            $timeout(function () {
                                canvas  = document.querySelector('#search-canvas-id');
                                context = canvas.getContext('2d');
                            },0);

                            socketService.getSocket('get_tag_floor', {tag: tag.id})
                                .then(function (response) {
                                    let message = JSON.parse(response.data);
                                    canvasCtrl.floorData.location = message.result[0].location_name;
                                    canvasCtrl.floorData.floorName = message.result[0].name;

                                    let img = new Image();
                                    img.src = imagePath + 'floors/' + message.result[0].image_map;

                                    img.onload = function () {
                                        canvas.width  = this.naturalWidth;
                                        canvas.height = this.naturalHeight;

                                        //updating the canvas and drawing border
                                        updateCanvas(canvas.width, canvas.height, context, img);

                                        let tagImg = new Image();
                                        tagImg.src = imagePath + 'icons/tag-online-icon.png';

                                        tagImg.onload = function () {
                                            drawIcon(tag, context, tagImg, message.result[0].width, canvas, true);
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
                                    '<div><p class="float-left">Latitude: </p><p class="float-right">' + newTag.gps_north_degree+ '</p></div>' +
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
    recoverPassController.$inject = ['$scope', 'recoverPassService', '$location'];
    function recoverPassController($scope, recoverPassService, $location) {
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
                        $location.path('/recover-password-code')
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
                            $location.path('/');
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
