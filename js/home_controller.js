(function(){
    'use strict';

    angular.module('main').controller('homeController', homeController);

    /**
     * Function that manges the home page including:
     * * locations on the map
     * * general alarms
     * @type {string[]}
     */
    homeController.$inject = ['$rootScope', '$scope', '$state', '$mdDialog', '$interval', '$timeout', 'NgMap', 'homeData', 'dataService', 'newSocketService', 'homeService'];

    function homeController($rootScope, $scope, $state, $mdDialog, $interval, $timeout, NgMap, homeData, dataService, newSocketService, homeService) {
        let homeCtrl = this;

        let markers              = homeData.markers;
        let tags                 = dataService.allTags;
        let bounds               = new google.maps.LatLngBounds();
        let alarmZoom           = undefined;
        let alarmLocations       = [];
        let imageIndex           = 0;
        let alarmLocationsLength = 0;
        // I use this varable so that the zoom is done only at the firs cicle, so that I can zoom out after automatic zoom
        let zoomSetter           = false;


        //visualizing the data according if the user is admin or not
        homeCtrl.isAdmin       = dataService.isAdmin;
        homeCtrl.isUserManager = dataService.isUserManager;

        homeCtrl.dynamicMarkers = [];

        homeCtrl.mapConfiguration = {
            zoom    : mapZoom,
            map_type: mapType,
            center  : mapCenter
        };

        //controlling if the user has already changed the default password, if yes I show the home screen
        if (homeData.password_changed) {
            dataService.loadUserSettings();

            /**
             * Function that find the location of the tags passed as parameter, then for each location sets the alarm if there is a tag of
             * a anchor in alarm. It zoom in zoom out according to locations that are in alarm
             * @param allTags
             * @param indoorTags
             * @param anchors
             * @param map
             */
            let setLocationsAlarms = (allTags, indoorTags, anchors, map) => {
                let alarmBounds = new google.maps.LatLngBounds();

                // looping through user locations
                markers.forEach((marker) => {
                    // getting the tags inside the current location
                    let markerObject = new google.maps.Marker({
                        position: new google.maps.LatLng(marker.position[0], marker.position[1]),
                    });

                    let markerSelected = homeCtrl.dynamicMarkers.filter(m => m.getPosition().lat() === markerObject.getPosition().lat() && m.getPosition().lng() === markerObject.getPosition().lng())[0];

                    // getting the situation of tags and anchors
                    let locationAnchors = homeService.getLocationAnchors(marker, anchors);
                    let locationTags    = homeService.getIndoorLocationTags(marker, indoorTags);
                    let locationTagsOutdoor = dataService.getOutdoorLocationTags(marker, allTags);
                    let tagAlarmsIndoor    = dataService.checkIfTagsHaveAlarmsInfo(locationTags);
                    let tagAlarmsOutdoor    = dataService.checkIfTagsHaveAlarmsInfo(locationTagsOutdoor);
                    let anchorAlarms = homeService.checkIfAnchorsHaveAlarmsOrAreOffline(locationAnchors);

                    // if the location is outdoor I control only the tags because I don't have anchors
                    if (!marker.is_inside) {
                        if (tagAlarmsOutdoor) {
                            // if the location isn't among the ones with an allarm, i add it
                            if (!dataService.alarmLocationsContainLocation(alarmLocations, marker))
                                alarmLocations.push(marker);

                            // I show the icon of the alarm
                            (imageIndex === 0)
                                ? markerSelected.setIcon(markersIconPath + ((marker.icon) ? marker.icon : 'location-marker.png'))
                                : markerSelected.setIcon(iconsPath + 'alarm-icon.png');
                            zoomSetter = false;
                        }
                        // if the location has no more alarms I remove it from the locations with alarm and restore the default icon
                        else {
                            if (homeService.alarmLocationsContainLocation(alarmLocations, marker)) {
                                alarmLocations = alarmLocations.filter(l => !angular.equals(l.position, marker.position));
                                markerSelected.setIcon(markersIconPath + ((marker.icon) ? marker.icon : 'location-marker.png'));
                            }
                        }
                    } else {
                        if (tagAlarmsIndoor || anchorAlarms) {
                            // if the location isn't among the ones with an allarm, i add it
                            if (!homeService.alarmLocationsContainLocation(alarmLocations, marker))
                                alarmLocations.push(marker);

                            // control if I have only tag alarms
                            if (tagAlarmsIndoor && !anchorAlarms) {
                                (imageIndex === 0)
                                    ? markerSelected.setIcon(markersIconPath + ((marker.icon) ? marker.icon : 'location-marker.png'))
                                    : markerSelected.setIcon(iconsPath + 'alarm-icon.png');
                            }
                            // control if I have both tags and anchor alarms
                            else if (tagAlarmsIndoor && anchorAlarms) {
                                (imageIndex === 0)
                                    ? markerSelected.setIcon(iconsPath + 'alarm-icon.png')
                                    : markerSelected.setIcon(iconsPath + 'offline_anchors_alert_64.png')
                            }
                            // controll if I have only anchor alarms
                            else if (anchorAlarms) {
                                (imageIndex === 0)
                                    ? markerSelected.setIcon(markersIconPath + ((marker.icon) ? marker.icon : 'location-marker.png'))
                                    : markerSelected.setIcon(iconsPath + 'offline_anchors_alert_64.png')
                            }
                            zoomSetter = false;
                        }
                        // if the location has no more alarms I remove it from the locations with alarm and restore the default icon
                        else{
                            alarmLocations = alarmLocations.filter(l => !angular.equals(l.position, marker.position));
                            markerSelected.setIcon(markersIconPath + ((marker.icon) ? marker.icon : 'location-marker.png'));
                        }
                    }
                });


                //resizing the zoom of the map to see only the locations in alarm
                if (alarmLocations.length > 0 && !zoomSetter){
                    alarmBounds = new google.maps.LatLngBounds();
                    alarmLocations.forEach(location => {
                        alarmBounds.extend(new google.maps.LatLng(location.position[0], location.position[1]))
                    });

                    map.fitBounds(alarmBounds)
                    zoomSetter = true;
                }

                imageIndex++;

                if (imageIndex === 2)
                    imageIndex = 0;
            };

            /**
             *  Function that control every second if the locations state has changed and update the location icon.
             *  Also show the icons for the alarms in the top corner
             * @param map
             */
            let constantUpdateNotifications = (map) => {
                // controlling if there are alarm for the tags and anchors
                dataService.homeTimer = $interval(() => {

                    if (DEBUG)
                        console.log ('updateing notifications');

                    // getting all the tags
                    newSocketService.getData('get_all_tags', {}, (response) => {
                        if (!response.session_state)
                            window.location.reload();

                        dataService.allTags = response.result;

                        // getting all the locations
                        newSocketService.getData('get_all_locations', {}, (locations) => {
                            if (!response.session_state)
                                window.location.reload();

                            // controlling if there are tags out off all the locations
                            dataService.allTags.forEach(function(tag){
                                // applying only for tags outdoor
                                if (dataService.isOutdoor(tag)) {
                                    // checking if any tag is out of all locations
                                    if(!homeService.checkIfAnyTagOutOfLocation(locations.result, tag) && dataService.switch.showOutrangeTags){
                                        homeCtrl.showAlarmsIcon = true;
                                    }
                                }
                            })
                        });

                        // showing the home alarm icons
                        homeCtrl.showAlarmsIcon      = dataService.checkIfTagsHaveAlarmsInfo(response.result);
                        homeCtrl.showOfflineTagsIcon = dataService.checkIfTagsAreOffline(response.result);

                        dataService.playAlarmsAudio(response.result);
                    });

                    // getting the anchors of the logged user
                    newSocketService.getData('get_anchors_by_user', {user: dataService.user.username}, (response) => {
                        if (!response.session_state)
                            window.location.reload();

                        // getting the tags of the logged user
                        newSocketService.getData('get_tags_by_user', {user: dataService.user.username}, (userTags) => {
                            if (!userTags.session_state)
                                window.location.reload();

                            // updating the locations state
                            setLocationsAlarms(dataService.allTags, userTags.result, response.result, map);

                            //setting the zoom of the map to see all the locations if there are no locations with alarms
                            if (alarmLocations.length === 0 && zoomSetter){
                                map.setCenter(bounds.getCenter());
                                map.fitBounds(bounds);
                                zoomSetter = false;
                            }

                            // setting the center of the map if there are no locations
                            if (homeCtrl.dynamicMarkers.length === 0){
                                map.setCenter(new google.maps.LatLng(44.44, 8.88));
                            }

                            // showing the anchors alarm icon if there are anchors in alarm
                            homeCtrl.showOfflineAnchorsIcon = homeService.checkIfAnchorsHaveAlarmsOrAreOffline(response.result);
                        });
                    });

                    // controlling if the engine is on and showing the icon if not
                    newSocketService.getData('get_engine_on', {}, (response) => {
                        if (!response.session_state)
                            window.location.reload();

                        // showing the engine icon if the ingine is offline
                        homeCtrl.showEngineOffIcon = response.result === 0;
                    })
                }, homeAlarmUpdateTime);
            };

            // enabling the call of constantUpdateNotifications from a different controller ( service )
            $rootScope.$on('constantUpdateNotifications', function (event, map) {
                constantUpdateNotifications(map);
            });

            NgMap.getMap('main-map').then((map) => {

                dataService.homeMap = map;

                // launching the loop for controlling the alarms for the tags and anchors
                constantUpdateNotifications(map);

                // setting the map style
                map.set('styles', mapConfiguration);

                // getting the tags of the current user
                newSocketService.getData('get_tags_by_user', {user: dataService.user.username}, (userTags) => {
                    // getting the anchors of the current user
                    newSocketService.getData('get_anchors_by_user', {user: dataService.user.username}, (response) => {

                        //creating the interaction with the location icon, infoWindow, click
                        markers.forEach(marker => {
                            // declaring the info window
                            let infoWindow = null;

                            // creating a new marker which is a copy of the current looped marker
                            let markerObject = new google.maps.Marker({
                                position : new google.maps.LatLng(marker.position[0], marker.position[1]),
                                animation: google.maps.Animation.DROP,
                                icon     : markersIconPath + ((marker.icon) ? marker.icon : (marker.is_inside) ? 'location-marker.png' : 'mountain.png')
                            });

                            // handling only the indoor locations
                            if (marker.is_inside) {
                                // filling the info window
                                infoWindow = homeService.fillInfoWindowInsideLocation(marker, userTags.result, response.result);
                            }
                            // handling only the outdoor locations
                            else {
                                // filling the info window
                                infoWindow = fillInfoWindowOutsideLocation(marker, dataService.allTags)
                            }

                            // open the info window on mouse over
                            markerObject.addListener('mouseover', function () {
                                infoWindow.open(map, this);
                            });

                            // closing the info window on mouse out
                            markerObject.addListener('mouseout', function () {
                                infoWindow.close(map, this);
                            });

                            // entering the location on marker click
                            markerObject.addListener('click', () => {
                                // saving the location I'm entering to the server side, to take it back if page refreshed
                                // the session is saved in the session variable
                                newSocketService.getData('save_location', {location: marker.name}, (response) => {
                                    // control if the session is ended
                                    if (!response.session_state)
                                        window.location.reload();

                                    // if the location is successfully saved
                                    if (response.result === 'location_saved') {
                                        // getting the information's about the saved location
                                        newSocketService.getData('get_location_info', {}, (locationInfo) => {
                                            if (!locationInfo.session_state)
                                                window.location.reload();

                                            // saving the location info locally
                                            dataService.location          = locationInfo.result;
                                            dataService.defaultFloorName  = '';
                                            dataService.locationFromClick = '';
                                            // redirecting to the location inside or outside accordingly
                                            (locationInfo.result.is_inside)
                                                ? $state.go('canvas')
                                                : $state.go('outdoor-location');
                                        });
                                    }
                                });
                            });
                            // pushing the created marker with the rest of the markers
                            homeCtrl.dynamicMarkers.push(markerObject);
                            // including the bounds of the new marker
                            bounds.extend(markerObject.getPosition());
                        });

                        // drawing the cluster of markers if any
                        homeCtrl.markerClusterer = new MarkerClusterer(map, homeCtrl.dynamicMarkers, {imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});

                        // if there are no markers I set the map to italy with default zoom
                        if (homeCtrl.dynamicMarkers.length === 0 && !zoomSetter) {
                            map.setCenter(new google.maps.LatLng(44.44, 8.88));
                            map.setZoom(mapZoom);
                            zoomSetter = true;
                        }
                        // if there is only a marker I set the map on the marker with default zoom
                        else if (homeCtrl.dynamicMarkers.length === 1 && !zoomSetter) {
                            map.setCenter(bounds.getCenter());
                            map.setZoom(mapZoom);
                            zoomSetter = true;
                        }
                        // if the map has more than one marker I let maps to set automatically the zoom
                        else {
                            map.setCenter(bounds.getCenter());
                            map.fitBounds(bounds);
                            zoomSetter = false;
                        }
                    })
                });
            });

            //showing the info window with the online/offline tags
            homeCtrl.showOfflineTagsHome = () => {
                // stopping the home interval
                dataService.homeTimer = dataService.stopTimer(dataService.homeTimer);
                dataService.showOfflineTags('home', constantUpdateNotifications, dataService.homeMap);
            };

            //showing the info window with the online/offline anchors
            homeCtrl.showOfflineAnchorsHome = () => {
                // stopping the home interval
                dataService.homeTimer = dataService.stopTimer(dataService.homeTimer);
                dataService.showOfflineAnchors('home', constantUpdateNotifications, dataService.homeMap);
            };

            //showing the info window with all the alarms
            // TODO - fatto fino a qui
            homeCtrl.showAlarmsHome = () => {
                // stoping the home timer
                dataService.homeTimer = dataService.stopTimer(dataService.homeTimer);

                let locationSelected = false;

                // showing the table with the alarms
                $mdDialog.show({
                    templateUrl        : componentsPath + 'indoor-alarms-info.html',
                    parent             : angular.element(document.body),
                    targetEvent        : event,
                    clickOutsideToClose: true,
                    multiple           : true,
                    controller         : ['$scope', 'dataService', ($scope, dataService) => {
                        $scope.alarms          = [];
                        $scope.outlocationTags = dataService.switch.showOutrangeTags;
                        let locations          = [];
                        let indoorLocationTags = [];
                        let localAlarms = [];
                        let allTags = [];

                        $scope.query = {
                            limitOptions: [5, 10, 15],
                            order       : 'name',
                            limit       : 5,
                            page        : 1
                        };

                        // starting the interval for updating the alarms in the table
                        dataService.alarmsInterval = $interval(() => {
                            if (DEBUG)
                                console.log('alarm timer runnning ...');

                            // getting all the tags
                            newSocketService.getData('get_all_tags', {}, (allTagsResult) => {

                                allTags = allTagsResult.result;

                                // getting all the tags of the logged user
                                // they are all the indoor tags because the tags are related to the users by the anchors and the anchors are
                                // only in indoor locations
                                newSocketService.getData('get_tags_by_user', {user: dataService.user.username}, (userTags) => {
                                    if (!userTags.session_state)
                                        window.location.reload();

                                    // get all the locations of the logged user
                                    newSocketService.getData('get_user_locations', {user: dataService.user.id}, (userLocations) => {
                                        if (!userLocations.session_state)
                                            window.location.reload();

                                        // getting all the locations
                                        newSocketService.getData('get_all_locations', {}, (response) => {
                                            if (!response.session_state)
                                                window.location.reload();

                                            locations = response.result;

                                            indoorLocationTags        = userTags.result;
                                            let indoorNoLocationTags  = allTags.filter(t => !dataService.isOutdoor(t) && t.anchor_id === null);
                                            let outdoorLocationTags   = allTags.filter(t => dataService.isOutdoor(t) && t.gps_north_degree !== -2 && t.gps_east_degree !== -2);
                                            let outdoorNoSiteTags     = allTags.filter(t => (dataService.isOutdoor(t) && homeService.isOutdoorWithoutLocation(t)));
                                            let outdoorNoLocationTags = [];

                                            outdoorLocationTags.forEach(tag => {
                                                if (!locations.some(l => dataService.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius)) {
                                                    if (!dataService.tagsArrayNotContainsTag(outdoorNoLocationTags, tag))
                                                        outdoorNoLocationTags.push(tag);
                                                }
                                            });

                                            //removing the tags that are out of location
                                            outdoorLocationTags = outdoorLocationTags.filter(t => !outdoorNoLocationTags.some(ot => ot.id === t.id));

                                            indoorLocationTags.forEach(tag => {
                                                let tagLocation = userLocations.result.filter(l => l.latitude === tag.location_latitude && l.longitude === tag.location_longitude);
                                                if (tagLocation !== undefined) {
                                                    let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tag, null, tagLocation[0].name);

                                                    if (tagAlarms.length === 0){
                                                        $scope.alarms = $scope.alarms.filter(a => a.tagId !== tag.id);
                                                    }

                                                    let localTagAlarms = $scope.alarms.filter(ta => tagAlarms.some(a => ta.tagId === a.tagId)).filter(lta => !tagAlarms.some(ta => lta.tagId === ta.tagId && lta.name === ta.name));
                                                    $scope.alarms      = $scope.alarms.filter(a => !localTagAlarms.some(lta => lta.tagId === a.tagId && lta.name === a.name))

                                                    tagAlarms.forEach(alarm => {
                                                        if (!dataService.alarmsArrayContainAlarm($scope.alarms, alarm))
                                                            $scope.alarms.push(alarm);
                                                    });
                                                }
                                            });

                                            indoorNoLocationTags.forEach(tag => {
                                                //inserting outside site alarm
                                                // $scope.alarms.push(dataService.createAlarmObjectForInfoWindow(tag, 'Tag senza posizione', "Il tag non ha una posizione definita", tagsIconPath + 'tag_withouth_position_24.png', lang.noPosition));

                                                //inserting tag alarms
                                                let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tag, null, lang.noLocation);

                                                if (tagAlarms.length === 0){
                                                    $scope.alarms = $scope.alarms.filter(a => a.tagId !== tag.id);
                                                }

                                                let localTagAlarms = $scope.alarms.filter(ta => tagAlarms.some(a => ta.tagId === a.tagId)).filter(lta => !tagAlarms.some(ta => lta.tagId === ta.tagId && lta.name === ta.name));
                                                $scope.alarms      = $scope.alarms.filter(a => !localTagAlarms.some(lta => lta.tagId === a.tagId && lta.name === a.name))

                                                tagAlarms.forEach(alarm => {
                                                    if (!dataService.alarmsArrayContainAlarm($scope.alarms, alarm))
                                                        $scope.alarms.push(alarm);
                                                })
                                            });

                                            outdoorLocationTags.forEach(tag => {
                                                if (!locations.some(l => dataService.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius))
                                                    if (!dataService.alarmsArrayContainAlarm($scope.alarms, alarm))
                                                        $scope.alarms.push(dataService.createAlarmObjectForInfoWindow(tag, 'Tag fuori sito', "Il tag e' fuori da tutti i siti", tagsIconPath + 'tag_out_of_location_24.png', lang.noLocation));

                                                let tagLocation = locations.filter(l => dataService.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius);
                                                if (tagLocation.length > 0) {
                                                    let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tag, null, tagLocation[0].name);

                                                    if (tagAlarms.length === 0){
                                                        $scope.alarms = $scope.alarms.filter(a => a.tagId !== tag.id);
                                                    }

                                                    let localTagAlarms = $scope.alarms.filter(ta => tagAlarms.some(a => ta.tagId === a.tagId)).filter(lta => !tagAlarms.some(ta => lta.tagId === ta.tagId && lta.name === ta.name));
                                                    $scope.alarms      = $scope.alarms.filter(a => !localTagAlarms.some(lta => lta.tagId === a.tagId && lta.name === a.name))

                                                    tagAlarms.forEach(alarm => {
                                                        if (!dataService.alarmsArrayContainAlarm($scope.alarms, alarm))
                                                            $scope.alarms.push(alarm);
                                                    })
                                                }
                                            });

                                            outdoorNoLocationTags.forEach(tag => {
                                                //inserting outsite site alarm
                                                let alarmOut = dataService.createAlarmObjectForInfoWindow(tag, 'Tag fuori sito', "Il tag e' fuori da tutti i siti", tagsIconPath + 'tag_out_of_location_24.png', lang.noLocation);
                                                if (!dataService.alarmsArrayContainAlarm($scope.alarms, alarmOut))
                                                    $scope.alarms.push(alarmOut);

                                                //inserting tag alarms
                                                let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tag, null, lang.noLocation);

                                                let localTagAlarms = $scope.alarms.filter(ta => tagAlarms.some(a => ta.tagId === a.tagId)).filter(lta => !tagAlarms.some(ta => lta.tagId === ta.tagId && lta.name === ta.name));

                                                localTagAlarms = localTagAlarms.filter(lta => !(lta.tagId === alarmOut.tagId && lta.name === alarmOut.name))

                                                if (localTagAlarms.length === 0)
                                                    $scope.alarms = $scope.alarms.filter(a => !(a.tagId === alarmOut.tagId && a.name !== alarmOut.name));

                                                $scope.alarms      = $scope.alarms.filter(a => !localTagAlarms.some(lta => lta.tagId === a.tagId && lta.name === a.name))

                                                tagAlarms.forEach(alarm => {
                                                    if (!dataService.alarmsArrayContainAlarm($scope.alarms, alarm))
                                                        $scope.alarms.push(alarm);
                                                })
                                            });

                                            outdoorNoSiteTags.forEach(tag => {
                                                dataService.loadTagAlarmsForInfoWindow(tag, null, 'Tag senza posizione').forEach(alarm => {
                                                    if (!dataService.alarmsArrayContainAlarm($scope.alarms, alarm))
                                                        $scope.alarms.push(alarm);
                                                })
                                            });

                                            // console.log($scope.alarms);
                                            $scope.$apply();
                                        });

                                    });
                                });
                            });
                        }, 1000);

                        //opening the location where the alarm is
                        $scope.loadLocation = (alarm) => {
                            let tag = allTags.filter(t => t.id === alarm.tagId)[0];

                            if (dataService.isOutdoor(tag)) {
                                //if the tag is outdoor and has no position i show tag not found message
                                if (tag.gps_north_degree === -2 && tag.gps_east_degree === -2) {
                                    $mdDialog.hide();
                                    $timeout(function () {
                                        $mdDialog.show({
                                            templateUrl        : componentsPath + 'tag-not-found-alert.html',
                                            parent             : angular.element(document.body),
                                            targetEvent        : event,
                                            clickOutsideToClose: true,
                                            controller         : ['$scope', '$controller', ($scope, $controller) => {
                                                $controller('languageController', {$scope: $scope});


                                                $scope.title   = lang.tagNotFound.toUpperCase();
                                                $scope.message = lang.tagNotLocation;

                                                $scope.hide = () => {
                                                    $mdDialog.hide();
                                                }
                                            }]
                                        })
                                    }, 100);
                                } else {
                                    let tagLocation = locations.filter(l => (dataService.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude])) <= l.radius);

                                    //if the tag has a location then I show go to the location
                                    if (tagLocation.length > 0) {
                                        newSocketService.getData('save_location', {location: tagLocation[0].name}, (response) => {
                                            if (!response.session_state)
                                                window.location.reload();

                                            if (response.result === 'location_saved') {
                                                locationSelected = true;
                                                $state.go('outdoor-location');
                                            }
                                        });
                                    } //if the tag is out of all the locations the I show the message tag out of locations
                                    else if (alarm.name === 'Tag fuori sito') {
                                        $mdDialog.show({
                                            locals             : {tagName: alarm},
                                            templateUrl        : componentsPath + 'search-tag-outside.html',
                                            parent             : angular.element(document.body),
                                            targetEvent        : event,
                                            clickOutsideToClose: true,
                                            controller         : ['$scope', 'NgMap', 'tagName', function ($scope, NgMap, tagName) {
                                                $scope.isTagOutOfLocation = 'background-red';
                                                $scope.locationName       = tagName.tag + ' ' + lang.tagOutSite.toUpperCase();
                                                $scope.mapConfiguration   = {
                                                    zoom    : 8,
                                                    map_type: mapType,
                                                };

                                                let tag = allTags.filter(t => t.name === tagName.tag)[0];

                                                newSocketService.getData('get_tag_outside_location_zoom', {}, (response) => {
                                                    if (!response.session_state)
                                                        window.location.reload();

                                                    $scope.mapConfiguration.zoom = response.result;
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
                                                    $mdDialog.hide();
                                                }
                                            }]
                                        })
                                    } else {
                                        $mdDialog.hide();
                                        $timeout(function () {
                                            $mdDialog.show({
                                                templateUrl        : componentsPath + 'tag-not-found-alert.html',
                                                parent             : angular.element(document.body),
                                                targetEvent        : event,
                                                clickOutsideToClose: true,
                                                controller         : ['$scope', '$controller', ($scope, $controller) => {
                                                    $controller('languageController', {$scope: $scope});


                                                    $scope.title   = lang.tagNotFound.toUpperCase();
                                                    $scope.message = lang.tagNotLocation;

                                                    $scope.hide = () => {
                                                        $mdDialog.hide();
                                                    }
                                                }]
                                            })
                                        }, 100);
                                    }
                                }
                            } else {
                                let indoorTag = indoorLocationTags.filter(t => t.id === tag.id)[0];

                                //if the tag has no location then I show the message tag not found
                                if (indoorTag === undefined) {
                                    $mdDialog.hide();
                                    $timeout(function () {
                                        $mdDialog.show({
                                            templateUrl        : componentsPath + 'tag-not-found-alert.html',
                                            parent             : angular.element(document.body),
                                            targetEvent        : event,
                                            clickOutsideToClose: true,
                                            controller         : ['$scope', '$controller', ($scope, $controller) => {
                                                $controller('languageController', {$scope: $scope});


                                                $scope.title   = lang.tagNotFound.toUpperCase();
                                                $scope.message = lang.tagNotLocation;

                                                $scope.hide = () => {
                                                    $mdDialog.hide();
                                                }
                                            }]
                                        })
                                    }, 100);
                                } //if the tag has a location then I go in the location
                                else {
                                    newSocketService.getData('save_location', {location: indoorTag.location_name}, (response) => {
                                        if (!response.session_state)
                                            window.location.reload();

                                        if (response.result === 'location_saved') {
                                            dataService.defaultFloorName  = indoorTag.floor_name;
                                            dataService.locationFromClick = indoorTag.location_name;
                                            $mdDialog.hide();
                                            locationSelected = true;
                                            $state.go('canvas');
                                        }
                                    });
                                }
                            }
                        };

                        $scope.hide = () => {
                            $mdDialog.hide();
                        }
                    }],
                    onRemoving         : function () {
                        dataService.alarmsInterval = dataService.stopTimer(dataService.alarmsInterval);

                        //TODO locationSelected has to be removed (terminate the home timer when enter location)
                        if (dataService.homeTimer === undefined && !locationSelected) {
                            NgMap.getMap('main-map').then((map) => {
                                constantUpdateNotifications(map)
                            });
                        }
                    }
                })
            };
        }//if the default password hasn't been changed, I force the user to change it
        else {
            $mdDialog.show({
                locals     : {password_changed: homeData.password_changed},
                templateUrl: componentsPath + 'change-password.html',
                parent     : angular.element(document.body),
                targetEvent: event,
                controller : ['$scope', 'password_changed', function ($scope, password_changed) {

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

                    //sending the new password to be modified to the database
                    $scope.sendPassword = (form) => {
                        form.$submitted = true;

                        if ($scope.changePassword.newPassword !== $scope.changePassword.reNewPassword) {
                            $scope.changePassword.resultClass = 'error-color';
                            $scope.changePassword.showError   = true;
                            $scope.changePassword.showSuccess = false;
                            $scope.changePassword.message     = lang.passwordNotEqual;
                        } else {
                            if (form.$valid) {
                                newSocketService.getData('change_password', {
                                    oldPassword: $scope.changePassword.oldPassword,
                                    newPassword: $scope.changePassword.newPassword
                                }, (response) => {
                                    if (!response.session_state)
                                        window.location.reload();

                                    if (response.result === 'ERROR_ON_CHANGING_PASSWORD_WRONG_OLD') {
                                        $scope.changePassword.resultClass = 'error-color';
                                        $scope.changePassword.showError   = true;
                                        $scope.changePassword.showSuccess = false;
                                        $scope.changePassword.message     = lang.oldPasswordNotValid;
                                    } else if (response.result === 'ERROR_ON_CHANGING_PASSWORD' || response.result === 'ERROR_ON_UPDATING_PASSWORD') {
                                        $scope.changePassword.resultClass = 'error-color';
                                        $scope.changePassword.showSuccess = false;
                                        $scope.changePassword.showError   = true;
                                        $scope.changePassword.message     = lang.impossibleChangePassword;
                                    } else {
                                        $scope.changePassword.resultClass = 'success-color';
                                        $scope.changePassword.showSuccess = true;
                                        $scope.changePassword.showError   = false;
                                        $scope.changePassword.message     = lang.passwordChanged;
                                        $timeout(function () {
                                            $mdDialog.hide();
                                            window.location.reload();
                                        }, 1000);
                                    }
                                    $scope.$apply();
                                });
                            } else {
                                $scope.changePassword.resultClass = 'error-color';
                            }
                        }
                    };

                    $scope.hide = () => {
                        if (password_changed === 1)
                            $mdDialog.hide();
                    }
                }]
            });
        }

        //on destroying the pag I release the resources and close all the dialogs
        $scope.$on('$destroy', function () {
            $mdDialog.hide();
            dataService.homeTimer = dataService.stopTimer(dataService.homeTimer);
        })
    }
})();