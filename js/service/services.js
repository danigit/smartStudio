(function () {
    'use strict';

    //reloading angular module
    let main = angular.module('main');


    //SERVICES
    main.service('dataService', dataService);
    main.service('recoverPassService', recoverPassService);
    // main.service('socketService', socketService);
    main.service('newSocketService', newSocketService);

    dataService.$inject = ['$mdDialog', '$interval', '$state', 'newSocketService'];

    function dataService($mdDialog, $interval, $state, newSocketService) {
        let service = this;

        service.user             = {};
        service.location             = '';
        service.locationFromClick    = '';
        service.isAdmin              = '';
        service.isUserManager              = '';
        service.isTracker              = '';
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
        service.playAlarm            = false;
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
        service.playedTime = 0;
        service.alarmsInterval = undefined;
        service.reconnectSocket = null;
        service.switch = {showFullscreen: false}
        service.lastMessageTime = null;



        service.showAlarms = (constantUpdateNotifications, map, position) => {
            // showing the table with the alarms
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', 'newSocketService', '$timeout', '$mdToast', ($scope, newSocketService, $timeout, $mdToast) => {

                    $scope.alarms          = [];
                    $scope.outlocationTags = service.switch.showOutrangeTags;
                    $scope.tableEmpty = true;

                    let locations          = [];
                    // noinspection JSMismatchedCollectionQueryUpdate
                    let indoorLocationTags = [];
                    // noinspection JSMismatchedCollectionQueryUpdate
                    let allTags = [];
                    // noinspection JSMismatchedCollectionQueryUpdate
                    let allTagsAlarms = [];

                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    // starting the interval for updating the alarms in the table
                    service.alarmsInterval = $interval(() => {
                        if (DEBUG)
                            console.log('alarm timer running ...');

                        // getting all the tags
                        newSocketService.getData('get_all_tags', {}, (allTagsResult) => {

                            allTags = allTagsResult.result.filter(t => !t.radio_switched_off);

                            // getting all the tags of the logged user
                            // they are all the indoor tags because the tags are related to the users by the anchors and the anchors are
                            // only in indoor locations
                            newSocketService.getData('get_tags_by_user', {user: service.user.username}, (userTags) => {

                                // get all the locations of the logged user
                                newSocketService.getData('get_user_locations', {user: service.user.id}, (userLocations) => {

                                    // getting all the locations
                                    newSocketService.getData('get_all_locations', {}, (response) => {

                                        locations = response.result;

                                        indoorLocationTags        = userTags.result.filter(t => !t.radio_switched_off);
                                        // the dags indoor have no location if the anchor is null
                                        let indoorNoLocationTags  = allTags.filter(t => !service.isOutdoor(t) && t.anchor_id === null);

                                        // getting the tags outdoor that have a location
                                        //TODO - the hasTagAValidGps is superflous because I control already in isOutdoor but I have to understand if isOutdoor
                                        // should controll ongli gps != 0
                                        let outdoorLocationTags   = allTags.filter(t => service.isOutdoor(t) && service.hasTagAValidGps(t));

                                        // getting the tags outdoor that have no site setted
                                        let outdoorNoSiteTags     = allTags.filter(t => (service.hasTagAnInvalidGps(t)));

                                        // getting the outdoor tags without any location
                                        let outdoorNoLocationTags = service.getTagsWithoutAnyLocation(outdoorLocationTags, locations);

                                        // removing the tags that are out of all the location
                                        outdoorLocationTags = outdoorLocationTags.filter(t => !outdoorNoLocationTags.some(ot => ot.id === t.id));

                                        allTagsAlarms = [];

                                        // getting the indoor tags with a location alarms
                                        indoorLocationTags.forEach(tag => {
                                            // getting the location of the current tag
                                            let tagLocation = userLocations.result.find(l => l.latitude === tag.location_latitude && l.longitude === tag.location_longitude);

                                            // i control if the tag has a location
                                            if (tagLocation !== undefined) {

                                                // getting the tags alarms
                                                service.loadTagAlarmsForInfoWindow(tag, tagLocation.name)
                                                    .forEach(alarm => {
                                                        allTagsAlarms.push(alarm);
                                                    });
                                            }
                                        });

                                        // getting the indoor tags without a location alarms
                                        indoorNoLocationTags.forEach(tag => {
                                            // getting the tags alarms
                                            service.loadTagAlarmsForInfoWindow(tag, lang.noLocation)
                                                .forEach(alarm => {
                                                    allTagsAlarms.push(alarm);
                                                })
                                        });

                                        // getting the outdoor locations tags alarms
                                        outdoorLocationTags.forEach(tag => {
                                            // getting tag location
                                            let tagLocation = locations.find(l => service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius);

                                            // i control if the tag has a location
                                            if (tagLocation !== undefined) {

                                                //getting the tags alarms
                                                service.loadTagAlarmsForInfoWindow(tag, tagLocation.name)
                                                    .forEach(alarm => {
                                                        allTagsAlarms.push(alarm);
                                                    })
                                            }
                                        });

                                        // getting the outdoor tags without a location alarms
                                        outdoorNoLocationTags.forEach(tag => {
                                            // show the tag as no location
                                            if (!locations.some(l => service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius)
                                                && service.switch.showOutrangeTags)
                                                allTagsAlarms.push(service.createAlarmObjectForInfoWindow(tag, lang.outOfSite, lang.outOfSiteDescription, tagsIconPath + 'tag_out_of_location.png', lang.noLocation));

                                            // getting tags alarms
                                            service.loadTagAlarmsForInfoWindow(tag, lang.noLocation)
                                                .forEach(alarm => {
                                                    allTagsAlarms.push(alarm);
                                                })
                                        });

                                        // getting the tags with no valida position alarms
                                        outdoorNoSiteTags.forEach(tag => {
                                            // getting the tags that have no valid position
                                            allTagsAlarms.push(service.createAlarmObjectForInfoWindow(tag, lang.noValidPosition, lang.noValidPositionDescription, tagsIconPath + 'tag_without_position.png', lang.noLocation));
                                        });

                                        // setting the alarms in the table
                                        $scope.alarms = allTagsAlarms;

                                        // controlling if there are alarms
                                        $scope.tableEmpty = ($scope.alarms.length === 0);
                                        $scope.$apply();
                                    });

                                });
                            });
                        });
                    }, ALARMS_WINDOW_UPDATE_TIME);

                    //opening the location where the alarm is
                    $scope.loadLocation = (alarm) => {

                        // getting the tag in alarm
                        let tag = allTags.find(t => t.id === alarm);

                        // controlling if the tag is in an outdoor location
                        if (service.isOutdoor(tag)) {
                            // if the tag is outdoor and has no position i show tag not found message
                            if (tag.gps_north_degree === -2 && tag.gps_east_degree === -2) {
                                showNotFountTagWindow()
                            } else {
                                // closing the alarms table
                                $mdDialog.hide();

                                // getting the outdoor location of the tag
                                let tagLocation = locations.find(l => (service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude])) <= l.radius);

                                // if the tag has a location then I go in the outdoor location
                                if (tagLocation !== undefined) {
                                    newSocketService.getData('save_location', {location: tagLocation.name}, (response) => {
                                        if (!response.session_state)
                                            window.location.reload();

                                        if (response.result === 'location_saved') {
                                            $state.go('outdoor-location');
                                        }
                                    });
                                }
                                //if the tag is out of all the locations the I show the message tag out of locations
                                else {
                                    $mdDialog.show({
                                        locals             : {alarmTag: tag},
                                        templateUrl        : componentsPath + 'search-tag-outside.html',
                                        parent             : angular.element(document.body),
                                        targetEvent        : event,
                                        clickOutsideToClose: true,
                                        controller         : ['$scope', 'NgMap', 'alarmTag', function ($scope, NgMap, alarmTag) {
                                            $scope.isTagOutOfLocation = 'background-red';
                                            $scope.locationName       = alarmTag.name + ' ' + lang.tagOutSite.toUpperCase();
                                            $scope.mapConfiguration   = {
                                                zoom    : 8,
                                                map_type: mapType,
                                            };

                                            newSocketService.getData('get_tag_outside_location_zoom', {}, (response) => {
                                                if (!response.session_state)
                                                    window.location.reload();

                                                $scope.mapConfiguration.zoom = response.result;
                                            });

                                            NgMap.getMap('search-map').then((map) => {
                                                map.set('styles', MAP_CONFIGURATION);
                                                let latLng = new google.maps.LatLng(alarmTag.gps_north_degree, alarmTag.gps_east_degree);

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
                                }
                            }
                        }
                        // here means that the tag is in an indoor location
                        else {
                            // getting the tag informations
                            let indoorTag = indoorLocationTags.find(t => t.id === tag.id);

                            //if the tag has no indoor location then I show the message tag not found
                            if (indoorTag === undefined) {
                                showNotFountTagWindow();
                            }
                            //if the tag has a location then I go in the location
                            else {
                                // closing the alarms table
                                $mdDialog.hide();
                                newSocketService.getData('save_location', {location: indoorTag.location_name}, (response) => {
                                    if (!response.session_state)
                                        window.location.reload();

                                    if (response.result === 'location_saved') {
                                        service.defaultFloorName  = indoorTag.floor_name;
                                        service.locationFromClick = indoorTag.location_name;
                                        $state.go('canvas');
                                    }
                                });
                            }
                        }
                    };

                    /**
                     * Function that shows a popup with the message that the tag has no location
                     */
                    let showNotFountTagWindow = () => {
                        service.showToast(
                            $mdToast,
                            'Il tag non appartiene a nessuna posizione!',
                            'background-darkred',
                            'color-white',
                            'top center');
                        // $timeout(function () {
                        //     $mdDialog.show({
                        //         templateUrl        : componentsPath + 'tag-not-found-alert.html',
                        //         parent             : angular.element(document.body),
                        //         targetEvent        : event,
                        //         clickOutsideToClose: true,
                        //         controller         : ['$scope', '$controller', ($scope, $controller) => {
                        //             $controller('languageController', {$scope: $scope});
                        //
                        //
                        //             $scope.title   = lang.tagNotFound.toUpperCase();
                        //             $scope.message = lang.tagNotLocation;
                        //
                        //             $scope.hide = () => {
                        //                 $mdDialog.hide();
                        //             }
                        //         }]
                        //     })
                        // }, 100);
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving         : function () {
                    service.alarmsInterval = service.stopTimer(service.alarmsInterval);

                    // starting the appropriate interval
                    switch (position) {
                        case 'home':
                            if (service.homeTimer === undefined)
                                constantUpdateNotifications(map);
                            break;
                        case 'outdoor':
                            if (service.updateMapTimer === undefined)
                                constantUpdateNotifications(map);
                            break;
                        case 'canvas':
                            console.log('restarting canvas');
                            if (service.canvasInterval === undefined)
                                constantUpdateNotifications();
                    }
                }
            })
        }

        // remain home
        /**
         * Function that control if the tag passed as parameter is outdoor
         * @param tag
         * @returns {boolean|boolean}
         */
        service.isOutdoor = (tag) => {
            return tag.gps_north_degree !== 0 && tag.gps_east_degree !== 0;
        };

        //remoin outdoor
        /**
         * Function that controls if the tag passed as parameter is an outdoor tag without any location
         * @param tag
         * @returns {boolean|boolean}
         */
        service.hasTagAnInvalidGps = (tag) => {
            return ((tag.gps_north_degree === -2 && tag.gps_east_degree === -2) || (tag.gps_north_degree === -1 && tag.gps_east_degree === -1));
        };

        //remain outdoor
        /**
         * Function that controls if the tag passed as parameter in not outside of every location
         * @param tag
         * @returns {boolean|boolean}
         */
        service.hasTagAValidGps= (tag) => {
            return tag.gps_north_degree !== -2 && tag.gps_east_degree !== -2;
        };

        /**
         * Function that get the tags without any location
         * @param outdoorLocationTags
         * @param locations
         * @returns {[]}
         */
        service.getTagsWithoutAnyLocation = (outdoorLocationTags, locations) => {
            let outdoorNoLocationTags = [];

            outdoorLocationTags.forEach(tag => {
                if (!locations.some(l => service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius)) {
                    if (!service.tagsArrayNotContainsTag(outdoorNoLocationTags, tag))
                        outdoorNoLocationTags.push(tag);
                }
            });

            return outdoorNoLocationTags;
        };

        //remain outdoor
        /**
         * Function that controls if there is any tag outdoor in order to show the alarm icon
         * @param tags
         * @param locations
         * @returns {boolean}
         */
        service.showAlarmForOutOfLocationTags = (tags, locations) => {
            return tags.some(t => { return !service.checkIfAnyTagOutOfLocation(locations, t)}) && service.switch.showOutrangeTags
        };

        //remain home
        //remain outdoor
        /**
         * Function that checks if the passed tag is out of all the locations
         * @param locations
         * @param tag
         * @returns {boolean}
         */
        service.checkIfAnyTagOutOfLocation = (locations, tag) => {
            return locations.some(l => (service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius));
        };

        //#####################################################################
        //#                             HOME FUNCTIONS                        #
        //#####################################################################

        //getting the anchors in the location passed as parameter
        // service.getLocationAnchors = (location, anchors) => {
        //     return anchors.filter(a => (a.location_latitude === location.position[0] && a.location_longitude === location.position[1]));
        // };

        // //controlling if the alarms array passed as parameter contains an alarm in the location passed as parameter as well
        // service.alarmLocationsContainLocation = (alarms, location) => {
        //     return alarms.some(l => l.position[0] === location.position[0] && l.position[1] === location.position[1])
        // };

        service.tagsArrayNotContainsTag = (tags, tag) => {
            return tags.some(t => t.id === tag.id);
        };

        service.alarmsArrayContainAlarm = (alarms, alarm) => {
            return alarms.some(a => a.tagId === alarm.tagId && a.name === alarm.name);
        };

        // getting the tags in the outdoor location passed as parameter
        // service.getOutdoorLocationTags = (location, tags) => {
        //     return tags.filter(t => !location.is_inside && service.isTagInLocation(t, location));
        // };

        // remain home
        // remain outdoor
        /**
         * Controlling if the tag passed as parameter is in the location passed as parameter as well
         * @param tag
         * @param location
         * @returns {boolean}
         */
        service.isTagInLocation = (tag, location) => {
            return service.getTagDistanceFromLocationOrigin(tag, location.position) <= location.radius;
        };

        /**
         * Function that control if the tag has a valid outdoor position
         * @param tag
         * @returns {boolean|boolean}
         */
        service.tagHasValidCoordinates = (tag) => {
            return tag.gps_north_degree !== -2 && tag.gps_east_degree !== -2 && tag.gps_north_degree !== -1 && tag.gps_east_degree !== -1
        };

        // remain service
        /**
         * Calculating the distance of the tag from the location center to see if the tag is in the location area
         * @param tag
         * @param origin
         * @returns {number}
         */
        service.getTagDistanceFromLocationOrigin = (tag, origin) => {
            if (service.tagHasValidCoordinates(tag)) {
                let distX = Math.abs(tag.gps_north_degree - origin[0]);
                let distY = Math.abs(tag.gps_east_degree - origin[1]);

                return Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2));
            }else {
                return Number.MAX_VALUE;
            }
        };

        // getting the tags in the location indoor passed as parameter
        // service.getIndoorLocationTags = (location, tags) => {
        //     return tags.filter(t => (location.position[0] === t.location_latitude && location.position[1] === t.location_longitude))
        // };

        // function that loads the user setting (the ones that go in quick actions)
        service.loadUserSettings = () => {
            newSocketService.getData('get_user_settings', {username: service.user.username}, (response) => {

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

                    // turning off the home turn off button if the audio is disabled
                    service.playAlarm = (response.result[0].sound_on === 1);
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

        // // check if the passed tag is out of all the locations
        // service.checkIfAnyTagOutOfLocation = (locations, tag) => {
        //     return locations.some(l => {
        //         if (!l.is_inside) {
        //             // control if the tag is out of the current location (l)
        //             return (service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius);
        //         }
        //     })
        // };

        // function that check if the tag is out of all the locations
        service.checkIfTagsAreOutOfLocations = (tags) => {

            return Promise.all(
                tags.map(function (tag) {
                    return new Promise(function (resolve) {
                        if (service.isOutdoor(tag)) {
                            newSocketService.getData('get_all_locations', {}, (response) => {
                                // console.log('GETTING ALL THE LOCATIONS')
                                resolve(!response.result.some(l => {
                                    if (!l.is_inside) {
                                        return (service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius);
                                    }
                                }))
                            })
                        } else {
                            resolve(false);
                        }
                    })
                })
            );
        };

        service.checkIfTagsHavePosition = (tags) => {
            let tagOutOfLocation = false;
            tags.forEach(tag => {
                if (service.isOutdoor(tag) && (tag.gps_north_degree === -2 && tag.gps_east_degree === -2)){
                    tagOutOfLocation = true;
                } else if (!service.isOutdoor(tag) && tag.anchor_id === null){
                    tagOutOfLocation = true;
                }
            });

            return tagOutOfLocation;
        }

        service.updateUserSettings = () => {
            let data = {grid_on: service.switch.showGrid, anchors_on: service.switch.showAnchors, cameras_on: service.switch.showCameras, outag_on: service.switch.showOutrangeTags, outdoor_tag_on: service.switch.showOutdoorTags, zones_on: service.switch.showZones, sound_on: service.switch.playAudio};
            let stringifyData = JSON.stringify(data);

            newSocketService.getData('update_user_settings', {username: service.user.username, data: stringifyData}, (response) => {
                if (!response.session_state)
                    window.location.reload();

                service.loadUserSettings();
            });
        };


        //function that show a window with the tags state
        service.showOfflineTags = (position, constantUpdateNotifications, map) => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor_offline_tags_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', '$controller', function ($scope) {
                    $scope.data              = [];

                    // saving the number of tags in different states
                    $scope.tagsStateIndoorOnline = 0;
                    $scope.tagsStateIndoorOffGrid = 0;
                    $scope.tagsStateIndoorOffTags = 0;

                    // setting the color for each category
                    $scope.colors = ["#4BAE5A", "#E12315", "#D3D3D3"];
                    // setting the name for each category
                    $scope.labels = [lang.activeTags, lang.shutDownTags, lang.disabledTags];

                    // continuously updating the tag situation
                    service.offlineTagsInterval     = $interval(function () {

                        if (DEBUG){
                            console.log('updating tags info window...')
                        }
                        //getting all the tags
                        // TODO - maybe I have to take only the tags of the current logged user
                        newSocketService.getData('get_all_tags', {}, (response) => {
                            // control if teh session is still active, if not reload the page
                            if (!response.session_state)
                                window.location.reload();

                            // getting the offline tags indoor
                            $scope.tagsStateIndoorOffGrid = response.result
                                .filter(t => (t.gps_north_degree === 0 && t.gps_east_degree === 0) && !t.radio_switched_off && ((Date.now() - new Date(t.time)) > t.sleep_time_indoor));

                            // getting teh offline tags outdoor
                            $scope.tagsStateOffGrid = response.result
                                .filter(t => (t.gps_north_degree !== 0 && t.gps_east_degree !== 0) && !t.radio_switched_off && ((Date.now() - new Date(t.gps_time)) > t.sleep_time_outdoor))
                                .concat($scope.tagsStateIndoorOffGrid);

                            // getting the shut down tags
                            $scope.tagsStateIndoorOffTags = response.result.filter(t => t.radio_switched_off);

                            // getting the online tags
                            $scope.tagsStateIndoorOnline  = response.result.length - $scope.tagsStateIndoorOffGrid.length - $scope.tagsStateIndoorOffTags.length;

                            // setting the data for the visualization
                            $scope.data = [$scope.tagsStateIndoorOnline, $scope.tagsStateIndoorOffTags.length, $scope.tagsStateIndoorOffGrid.length];
                        });
                    }, TAGS_ALARMS_WINDOW_UPDATE_TIME);

                    // hide the window on click
                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                // stoping the interva (request for data) when the window closes
                onRemoving: function(){
                    service.offlineTagsInterval = service.stopTimer(service.offlineTagsInterval);

                    // starting the appropriate interval
                    switch (position) {
                        case 'home':
                            if (service.homeTimer === undefined)
                                constantUpdateNotifications(map);
                            break;
                        case 'outdoor':
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

        // remain home
        // remain outdoor
        /**
         * Checking if there is at least one tag offline among the passed tags
         * @param tags
         * @returns {boolean}
         */
        service.checkIfTagsAreOffline = (tags) => {
            return tags.some(t => service.isTagOffline(t));
        };

        // remain outdoor
        // remain canvas
        /**
         * Function that check if there is at least an anchor offline
         * @param anchors
         * @returns {*}
         */
        service.checkIfAnchorsAreOffline = (anchors) => {
            return anchors.some(a => {return (a.is_offline || a.battery_status)});
        };

        //checking if there is at least an anchor offline
        service.checkIfAreAnchorsOffline = (anchors) => {
            return anchors.some(function (anchor) {
                return anchor.is_offline === 1;
            });
        };

        // filling the info window for the locations indoor in the home page
        // service.fillInfoWindowInsideLocation = (marker, userTags, userAnchors) => {
        //     // getting the current marker tags
        //     let locationTags    = service.getIndoorLocationTags(marker, userTags);
        //     //getting the current marker anchors
        //     let locationAnchors = service.getLocationAnchors(marker, userAnchors);
        //
        //     // creating the content of the window
        //     return new google.maps.InfoWindow({
        //         content: '<div class="marker-info-container">' +
        //             '<img src="' + markersIconPath + marker.icon + '" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
        //             '<p class="text-center font-large font-bold color-darkcyan">' + marker.name.toUpperCase() + '</p>' +
        //             '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + marker.position[0] + '</b></p></div>' +
        //             '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + marker.position[1] + '</b></p></div>' +
        //             '<div class="clear-float display-flex"><div class="width-50 margin-left-10-px"><img src="' + iconsPath + 'offline_tags_alert_30.png" class="margin-right-5-px"><span class="font-large vertical-align-super color-red"><b>' + locationTags.length + '</b></span>' +
        //             '</div><div class="width-45 "><img src="' + iconsPath + 'offline_anchors_alert_30.png" class="margin-right-10-px"><span class="font-large vertical-align-super color-red"><b>' + locationAnchors.length + '</b></span></div></div>' +
        //             '</div>'
        //     });
        // };

        // filling teh info window for the locations outdoor in the home page
        // service.fillInfoWindowOutsideLocation = (marker, userTags) => {
        //     // getting the current marker tags
        //     let locationTags = service.getOutdoorLocationTags(marker, userTags);
        //
        //     // filling the info window
        //     return new google.maps.InfoWindow({
        //         content: '<div class="marker-info-container">' +
        //             '<img src="' + markersIconPath + marker.icon + '" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
        //             '<p class="text-center font-large font-bold color-darkcyan">' + marker.name.toUpperCase() + '</p>' +
        //             '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + marker.position[0] + '</b></p></div>' +
        //             '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + marker.position[1] + '</b></p></div>' +
        //             '<div class="clear-float display-flex"><div class="margin-auto"><img src="' + iconsPath + 'offline_tags_alert_30.png" class="margin-right-5-px"><span class="font-large vertical-align-super color-red"><b>' + locationTags.length + '</b></span>' +
        //             '</div></div' +
        //             '</div>'
        //     });
        // };


        //#####################################################################
        //#                          OUTDOOR FUNCTIONS                        #
        //#####################################################################


        service.getProtocol = (history_rows) => {
            let historyRows = [];

            history_rows.forEach(function (his) {
                let hisRow = his;
                switch (his.protocol) {
                    case 0: {
                        hisRow.protocol = lang.ble;
                        break;
                    }
                    case 1: {
                        hisRow.protocol = lang.wifi;
                        break;
                    }
                    case 2: {
                        hisRow.protocol = lang.gprs;
                        break;
                    }
                    case 3: {
                        hisRow.protocol = lang.safetyBox;
                        break;
                    }
                }

                switch (his.man_down_cause) {
                    case 0: {
                        hisRow.man_down_cause = lang.noCause;
                        break;
                    }
                    case 1: {
                        hisRow.man_down_cause = lang.freefall;
                        break;
                    }
                    case 2: {
                        hisRow.man_down_cause = lang.lndPrt;
                        break;
                    }
                    case 3: {
                        hisRow.man_down_cause = lang.noMov;
                        break;
                    }
                }

                historyRows.push(hisRow)
            });
            return historyRows;
        };

        service.showToast = ($mdToast, message, background, color, position = 'bottom center') => {
            $mdToast.show({
                hideDelay       : TOAST_SHOWING_TIME,
                position        : position,
                controller      : 'toastController',
                bindToController: true,
                locals          : {
                    message   : message,
                    background: background,
                    color     : color
                },
                templateUrl     : componentsPath + 'toast.html'
            });
        };

        // remain outdoor
        /**
         * Function that sets the alarm icon for the marker
         * @param tag
         * @param marker
         */
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

        // remain outdoor
        /**
         * Funtion that set the online icon for the marker
         * @param marker
         */
        service.setMarkerOnlineIcon = (marker) => {
            marker.setIcon(tagsIconPath + 'online_tag_24.png');
        };

        // remain outdoor
        /**
         * Function that set the offline icon for the marker
         * @param marker
         */
        service.setMarkerOfflineIcon = (marker) => {
            marker.setIcon(tagsIconPath + 'offline_tag_24.png');
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
                    if ((Math.abs(tagElement.x_pos - groupTagDistance) < tag.x_pos && tag.x_pos < Math.abs(tagElement.x_pos + groupTagDistance)
                        && (Math.abs(tagElement.y_pos - groupTagDistance) < tag.y_pos && tag.y_pos < Math.abs(tagElement.y_pos + groupTagDistance)))) {
                        if (service.checkIfTagHasAlarm(tag) || !tag.radio_switched_off){

                            if (!tagsGrouping.groupTags.some(t => t.id === tag.id)) {
                                tagsGrouping.groupTags.push(tag);
                            }
                        }

                        if (service.checkIfTagHasAlarm(tagElement)) {
                            tagsGrouping.groupTags.push(tagElement)
                        } else if (!tagElement.radio_switched_off) {
                            tagsGrouping.groupTags.push(tagElement)
                        }
                    } else {
                        // console.log(tagElement)
                        tagsGrouping.singleTags.push(tagElement);
                    }
                }
            });
            return tagsGrouping;
        };

        // showing the info window with the online/offline anchors
        service.showOfflineAnchors = (position, constantUpdateNotifications, map) => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor_offline_anchors_info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', function ($scope) {
                    $scope.offlineAnchors = 0;
                    $scope.shutDownAnchors = 0;
                    $scope.onlineAnchors = 0;
                    $scope.data           = [];

                    // setting the color for each category
                    $scope.colors = ["#D3D3D3", "#4BAE5A", "#E12315"];
                    // setting the text for each category
                    $scope.labels = [lang.disabledAnchors, lang.enabledAnchors, lang.shutDownAnchors];

                    // getting all the anchors of the current logged user
                    service.offlineAnchorsInterval = $interval(function () {

                        if (DEBUG){
                            console.log('updating alarms info window...')
                        }

                        newSocketService.getData('get_anchors_by_user', {user: service.user.username}, (response) => {
                            if (!response.session_state)
                                window.location.reload();

                            // getting the offline anchors
                            $scope.offlineAnchors = response.result.filter(a => a.is_offline);
                            // getting the shut down anchors
                            $scope.shutDownAnchors = response.result.filter(a => a.battery_status === 1);
                            // getting the online anchors
                            $scope.onlineAnchors = response.result.length - $scope.offlineAnchors.length - $scope.shutDownAnchors.length;

                            // setting the data to be visualized
                            $scope.data = [$scope.offlineAnchors.length, $scope.onlineAnchors, $scope.shutDownAnchors.length];
                        });
                    }, ANCHORS_ALARMS_WINDOW_UPDATE_TIME);

                    // closing teh pop up
                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                // stoping the interval (request for data) when the window closes
                onRemoving: function(){
                    service.offlineAnchorsInterval = service.stopTimer(service.offlineAnchorsInterval);

                    // restarting the appropriate interval
                    switch (position) {
                        case 'home':
                            if (service.homeTimer === undefined)
                                constantUpdateNotifications(map);
                            break;
                        case 'outdoor':
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

        // service.isTagInLocation = (tag, location) => {
        //     return service.getTagDistanceFromLocationOrigin(tag, location.position) <= location.radius;
        // };

        // remain canvas
        //getting all the alarms of the tag passed as parameter and creating the objects to be shown in info window
        service.loadTagAlarmsForInfoWindow = (tag, tagLocation) => {
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

            // if (locations !== null) {
            //     if (service.isOutdoor(tag) && locations.length > 0) {
            //         let isInLocation = locations.some(l => service.getTagDistanceFromLocationOrigin(tag, [l.latitude, l.longitude]) <= l.radius);
            //         if (!isInLocation) {
            //             alarms.push(service.createAlarmObjectForInfoWindow(tag, 'Tag fuori sito', "Il tag e' fuori da tutti i siti", tagsIconPath + 'tag_out_of_location_24.png'));
            //         }
            //     }
            // }

            return alarms;
        };

        // service.getIndoorTagLocation = (tag) => {
        //     return new Promise(resolve => {
        //         socketService.sendRequest('get_indoor_tag_location', {tag: tag.id})
        //             .then((response) => {
        //                 if (response.result.session_state)
        //                     window.location.reload();
        //
        //                 console.log(response);
        //                 resolve(response.result);
        //             })
        //     })
        // };

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
        // remain canvas
        service.checkIfTagsHaveAlarms = (tags) => {
            return tags.some(function (tag) {
                return tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                    || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                    || tag.call_me_alarm || tag.diagnostic_request || tag.inside_zone;
            })
        };

        // remain home
        // remain outdoor
        /**
         * Checking if any of the the passed tags have at least one alarm
         * @param tags
         * @returns {boolean}
         */
        service.checkIfTagsHaveAlarmsInfo = (tags) => {
            return tags.some(tag => tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                    || tag.battery_status || tag.man_in_quote || tag.call_me_alarm || tag.diagnostic_request || tag.inside_zone)
        };

        // remain outdoor
        /**
         * Function that control if there is any tag with an alarm
         * @param tags
         * @returns {*}
         */
        service.checkIfTagsHaveAlarmsOutdoor = (tags) => {
            return tags.some(tag => service.isOutdoor(tag) && service.isTagInLocation(tag, {radius: service.location.radius, position: [service.location.latitude, service.location.longitude]}) && (tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                || tag.call_me_alarm || tag.diagnostic_request));
        };

        // checking if at least one of the passed anchors has an alarm
        // service.checkIfAnchorsHaveAlarmsOrAreOffline = (anchors) => {
        //     return anchors.some(a => a.battery_status || a.is_offline === 1);
        // };

        // checking if at least one of the passed anchors has an alarm
        service.checkIfAnchorsHaveAlarms = (anchors) => {
            return anchors.some(a => a.battery_status);
        };

        // remain home
        // remain outdoor
        /**
         * Function that plays the alarms audio of the tags passed as parameter
         * @param tags
         */
        service.playAlarmsAudio = (tags) => {
            let audio;

            // reseting the alarms if there are no tags
            if (tags.length === 0){
                service.alarmsSounds = [];
                service.playAlarm = false;
            }

            // incrementing the number after which the next play is going to happen
            service.playedTime++;

            // getting the allarms to be played
            tags.forEach(function (tag) {
                if (tag.battery_status) {
                    // control if the alarm is already considered, if not I add it to the allarms to play
                    if (!controlIfAlarmIsInArray(service.alarmsSounds, tag.name, 'battery')) {
                        service.alarmsSounds.push({tag: tag.name, alarm: 'battery'});
                        service.playAlarm = true;
                    }
                }
                // if the alarm is no more active I remove it
                else {
                    service.alarmsSounds = filterAlarms(service.alarmsSounds, tag.name, 'battery');
                }

                if (tag.man_down) {
                    // control if the alarm is already considered, if not I add it to the allarms to play
                    if (!controlIfAlarmIsInArray(service.alarmsSounds, tag.name, 'mandown')) {
                        service.alarmsSounds.push({tag: tag.name, alarm: 'mandown'});
                        service.playAlarm = true;
                    }
                }
                // if the alarm is no more active I remove it
                else {
                    service.alarmsSounds = filterAlarms(service.alarmsSounds, tag.name, 'mandown');
                }

                if (tag.sos) {
                    // control if the alarm is already considered, if not I add it to the allarms to play
                    if (!controlIfAlarmIsInArray(service.alarmsSounds, tag.name, 'sos')) {
                        service.alarmsSounds.push({tag: tag.name, alarm: 'sos'});
                        service.playAlarm = true;
                    }
                }
                // if the alarm is no more active I remove it
                else {
                    service.alarmsSounds = filterAlarms(service.alarmsSounds, tag.name, 'sos');
                }
            });

            // control if there are allarm to be played
            if (service.alarmsSounds.length !== 0){
                // control what type of alarm I have to play set the audio
                if (service.alarmsSounds.length > 1 && (service.switch && service.switch.playAudio)) {
                    audio = new Audio(audioPath + 'sndMultipleAlarm.mp3');
                } else {
                    if (controlIfArrayHasAlarm(service.alarmsSounds, 'battery')) {
                        audio = new Audio(audioPath + 'sndBatteryAlarm.mp3');
                    }
                    if (controlIfArrayHasAlarm(service.alarmsSounds, 'mandown')) {
                        audio = new Audio(audioPath + 'sndManDownAlarm.mp3');
                    }
                    if (controlIfArrayHasAlarm(service.alarmsSounds, 'sos')) {
                        audio = new Audio(audioPath + 'indila-sos.mp3');
                    }
                }
            } else{
                service.playAlarm = false;
            }

            // play the alarm
            if (audio !== undefined && service.playedTime > AUDIO_PLAY_INTERVAL && (service.switch && service.switch.playAudio) && service.playAlarm){
                // waiting for the audio to load
                audio.addEventListener('loadeddata', () => {
                    audio.play();
                });

                service.playedTime = 0;
            }

            // if the alarm audio is disabled playTime will increase forever sow I reset it
            if (service.playedTime > AUDIO_PLAY_INTERVAL + 1)
                service.playedTime = 0
        };

        // remain outdoor
        // remain canvas
        /**
         * Function that controll if the tag has at least an alarm
         * @param tag
         * @returns {string|*}
         */
        service.checkIfTagHasAlarm = (tag) => {
            return tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                || tag.call_me_alarm || tag.diagnostic_request;
        };

        let isCategoryAndImageNotNull = (tag) => {
            return tag.category_id !== null && tag.icon_name_alarm && tag.icon_name_no_alarm !== null;
        };

        // remain outdoor
        // remain canvas
        /**
         * Function that returns the images of the alarms of the tags passed as parameter
         * @param tag
         * @returns {[]}
         */
        service.getTagAlarms = (tag) => {
            let tagAlarmsImages = [];

            let category_name_alarm = '';
            let category_name_no_alarm = '';

            if(isCategoryAndImageNotNull(tag)){
                category_name_alarm = tag.icon_name_alarm.split('.').slice(0, -1).join('.');
                category_name_no_alarm = tag.icon_name_no_alarm.split('.').slice(0, -1).join('.');
            }

            if (tag.sos) {
                if (isCategoryAndImageNotNull(tag)){
                    tagAlarmsImages.push(tagsIconPath + category_name_alarm + '_sos.png');
                }else {
                    tagAlarmsImages.push(tagsIconPath + 'sos_24.png');
                }
            }
            if (tag.man_down) {
                if (isCategoryAndImageNotNull(tag)){
                    tagAlarmsImages.push(tagsIconPath + category_name_alarm + '_man_down.png')
                } else {
                    tagAlarmsImages.push(tagsIconPath + 'man_down_24.png');
                }
            }
            if (tag.battery_status) {
                if (isCategoryAndImageNotNull(tag)){
                    tagAlarmsImages.push(tagsIconPath + category_name_alarm + '_battery_low.png')
                } else {
                    tagAlarmsImages.push(tagsIconPath + 'battery_low_24.png');
                }
            }
            if (tag.helmet_dpi) {
                if (isCategoryAndImageNotNull(tag)){
                    tagAlarmsImages.push(tagsIconPath + category_name_alarm + 'helmet_dpi.png')
                } else {
                    tagAlarmsImages.push(tagsIconPath + 'helmet_dpi_24.png');
                }
            }
            if (tag.belt_dpi) {
                if (isCategoryAndImageNotNull(tag)){
                    tagAlarmsImages.push(tagsIconPath + category_name_alarm + 'belt_dpi.png')
                } else {
                    tagAlarmsImages.push(tagsIconPath + 'belt_dpi_24.png');
                }
            }
            if (tag.glove_dpi) {
                if (isCategoryAndImageNotNull(tag)){
                    tagAlarmsImages.push(tagsIconPath + category_name_alarm + 'glove_dpi.png')
                } else {
                    tagAlarmsImages.push(tagsIconPath + 'glove_dpi_24.png');
                }
            }
            if (tag.shoe_dpi) {
                if (isCategoryAndImageNotNull(tag)){
                    tagAlarmsImages.push(tagsIconPath + category_name_alarm + 'shoe_dpi.png')
                } else {
                    tagAlarmsImages.push(tagsIconPath + 'shoe_dpi_24.png');
                }
            }
            if (tag.man_down_disabled) {
                if (isCategoryAndImageNotNull(tag)){
                    tagAlarmsImages.push(tagsIconPath + category_name_alarm + 'man_down_dpi.png')
                } else {
                    tagAlarmsImages.push(tagsIconPath + 'man-down-disabled_24.png');
                }
            }
            if (tag.man_down_tacitated) {
                if (isCategoryAndImageNotNull(tag)){
                    tagAlarmsImages.push(tagsIconPath + category_name_alarm + 'man_down_tacitated.png')
                } else {
                    tagAlarmsImages.push(tagsIconPath + 'man-down-tacitated_24.png');
                }
            }
            if (tag.man_in_quote) {
                if (isCategoryAndImageNotNull(tag)){
                    tagAlarmsImages.push(tagsIconPath + category_name_alarm + 'man_in_quote.png')
                } else {
                    tagAlarmsImages.push(tagsIconPath + 'man_in_quote_24.png');
                }
            }
            if (tag.call_me_alarm) {
                if (isCategoryAndImageNotNull(tag)){
                    tagAlarmsImages.push(tagsIconPath + category_name_no_alarm + 'call_me_alarm.png')
                } else {
                    tagAlarmsImages.push(tagsIconPath + 'call_me_alarm_24.png');
                }
            }

            return tagAlarmsImages;
        };

        //calculating the distance of the tag from the location center
        // service.getTagDistanceFromLocationOrigin = (tag, origin) => {
        //
        //     let distX = Math.abs(tag.gps_north_degree - origin[0]);
        //     let distY = Math.abs(tag.gps_east_degree - origin[1]);
        //
        //     return Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2));
        // };

        //function that control if the tag is indoor
        service.isOutdoor = (tag) => {
            return tag.gps_north_degree !== 0 && tag.gps_east_degree !== 0 && tag.pps_north_degree !== -2 && tag.gps_east_degree !== -2;
        };

        //function that control if the tag is indoor
        // service.isOutdoorWithoutLocation = (tag) => {
        //     return tag.gps_north_degree === -2 && tag.gps_east_degree === -2;
        // };

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
                    || tag.battery_status || tag.man_in_quote
                    || tag.call_me_alarm || tag.diagnostic_request || tag.inside_zone) {
                    tagState.withAlarm = true;
                } else if (service.isTagOffline(tag)){
                    tagState.offline = true;
                } else if(!tag.radio_switched_off){
                    tagState.withoutAlarm = true;
                }
            });

            return tagState;
        };

        service.checkIfTagOutOfLocationHasAlarm = function(tags) {
            return tags.some(t => t.gps_north_degree === -1 && t.gps_east_degree === -1 && service.checkIfTagHasAlarm(t));
        };

        //controlling the alarms and setting the alarm icon
        service.assigningTagImage = (tag, image) => {
            let category_name_alarm = '';
            let category_name_no_alarm = '';

            if(isCategoryAndImageNotNull(tag)){
                category_name_alarm = tag.icon_name_alarm.split('.').slice(0, -1).join('.');
                category_name_no_alarm = tag.icon_name_no_alarm.split('.').slice(0, -1).join('.');
            }

            if (tag.sos) {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_alarm + '_sos.png';
                } else {
                    image.src = tagsIconPath + 'sos_24.png';
                }
            } else if (tag.man_down) {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_alarm + '.png';
                } else {
                    image.src = tagsIconPath + 'man_down_24.png';
                }
            } else if (tag.battery_status) {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_alarm + '.png';
                } else {
                    image.src = tagsIconPath + 'battery_low_24.png';
                }
            } else if (tag.helmet_dpi) {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_alarm + '.png';
                } else {
                    image.src = tagsIconPath + 'helmet_dpi_24.png';
                }
            } else if (tag.belt_dpi) {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_alarm + '.png';
                } else {
                    image.src = tagsIconPath + 'belt_dpi_24.png';
                }
            } else if (tag.glove_dpi) {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_alarm + '.png';
                } else {
                    image.src = tagsIconPath + 'glove_dpi_24.png';
                }
            } else if (tag.shoe_dpi) {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_alarm + '.png';
                } else {
                    image.src = tagsIconPath + 'shoe_dpi_24.png';
                }
            } else if (tag.man_down_disabled) {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_alarm + '.png';
                } else {
                    image.src = tagsIconPath + 'man_down_disabled_24.png';
                }
            } else if (tag.man_down_tacitated) {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_alarm + '.png';
                } else {
                    image.src = tagsIconPath + 'man_down_tacitated_24.png';
                }
            } else if (tag.man_in_quote) {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_alarm + '.png';
                } else {
                    image.src = tagsIconPath + 'man_in_quote_24.png';
                }
            } else if (tag.call_me_alarm) {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_alarm + '.png';
                } else {
                    image.src = tagsIconPath + 'call_me_alarm_24.png';
                }
            } else {
                if (isCategoryAndImageNotNull(tag)){
                    image.src = tagsIconPath + category_name_no_alarm + '.png';
                } else {
                    if (service.isTagOffline(tag)){
                        image.src = tagsIconPath + 'offline_tag_24.png';
                    }else{
                        image.src = tagsIconPath + 'online_tag_24.png';
                    }
                }
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
                                    // console.log(value)
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
                                    } else{
                                        resolve(null)
                                    }
                                } else {
                                    if (service.checkIfTagHasAlarm(value)) {
                                        service.assigningTagImage(value, img);
                                    } else if (service.isTagOffline(value)) {
                                        service.assigningTagImage(value, img);
                                        // img.src = tagsIconPath + 'offline_tag_24.png';
                                    } else {
                                        service.assigningTagImage(value, img);
                                        // img.src = tagsIconPath + 'online_tag_24.png';
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

        // service.getTagsLocation = async (tags, locations, userLocations) => {
        //     console.log(locations);
        //     console.log(userLocations);
        //     let alarms = [];
        //     let tagAlarms = [];
        //
        //     for (let i = 0; i < tags.length; i++) {
        //
        //         if (!service.isOutdoor(tags[i])) {
        //             await socketService.sendRequest('get_indoor_tag_location', {tag: tags[i].id})
        //                 .then((response) => {
        //                     if (response.result.session_state)
        //                         window.location.reload();
        //
        //                     console.log(response);
        //                     if (response.result.name !== undefined)
        //                         tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, response.result.name);
        //                     else
        //                         tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, lang.noLocation);
        //                 })
        //         }else{
        //             let someResult = locations.filter(l => service.getTagDistanceFromLocationOrigin(tags[i], [l.latitude, l.longitude]) <= l.radius);
        //             if (someResult.length !== 0 && userLocations !== undefined && userLocations.some(l => l.name === someResult[0].name)){
        //                 console.log('is use location')
        //                 tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, someResult[0].name);
        //             } else {
        //                 tagAlarms = service.loadTagAlarmsForInfoWindow(tags[i], locations, lang.noLocation);
        //             }
        //         }
        //
        //         alarms.push(tagAlarms);
        //         tagAlarms = [];
        //     }
        //
        //     return alarms;
        // };

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

        service.hasTagCategory = (tags) => {
            if (tags.length === 0)
                return false;

            return tags.some(t => t.category_id !== null)
        };

        service.isElementAtClick = (virtualTagPosition, mouseDownCoords, distance) => {
            return ((virtualTagPosition.width - distance) < mouseDownCoords.x && mouseDownCoords.x < (virtualTagPosition.width + distance)) && ((virtualTagPosition.height - distance) < mouseDownCoords.y && mouseDownCoords.y < (virtualTagPosition.height + distance));
        };

        service.isTagOffline = (tag) => {
            return ((tag.gps_north_degree !== 0 && tag.gps_east_degree !== 0) && !tag.radio_switched_off && (((Date.now() - new Date(tag.gps_time)) > tag.sleep_time_outdoor)))
                || ((tag.gps_north_degree === 0 && tag.gps_east_degree === 0) && !tag.radio_switched_off && (((Date.now() - new Date(tag.time)) > tag.sleep_time_indoor)));

        };

        // service.showAlarms = () => {}
    }

    /**
     * Function that estabilish a connection via socket to the server, and exchange messages between client and server
     * It handeles the reconection of the socket if has been closed
     * @type {string[]}
     */
    newSocketService.$inject = ['$state', '$interval'];
    function newSocketService($state, $interval) {
        let service              = this;
        let id = 0;

        service.server               = socketServer;
        service.callbacks = [];

        /**
         * Function that gets the data from the client and sends it to the server, and when a message is received from the
         * server, is calls the appropriate function on client
         * @param action
         * @param data
         * @param callback
         */
        service.getData = (action, data, callback) => {

            let userData = {};

            //adding the user to the data sended to the server
            if (action !== 'login') {
                data.username = cesarShift(sessionStorage.user, -CEZAR_KEY);
            }

            userData = data;
            // console.log('after data: ' + userData);
            let stringifyedData = JSON.stringify({action: action, data: userData});

            if (socketOpened) {
                service.server.send(stringifyedData);
                service.callbacks.push({id: id, value: callback});
                service.lastMessageTime = new Date();
                $interval.cancel(service.reconnectSocket);

                service.server.onmessage = (response) => {
                    let now = new Date();
                    if (Math.abs(now.getTime() - service.lastMessageTime.getTime()) > MESSAGE_WAITING_TIME){
                        console.log('CLOSING THE SOCKET BECAUSE THE NETWORK IS TOO SLOW');
                        service.server.close();

                    }else {
                        let result = JSON.parse(response.data);
                        let call   = service.callbacks.shift();
                        call.value(result);
                    }
                };
            }

            service.server.onerror = (error) => {
                let call = service.callbacks.shift();
                // call.value('error');
            };

            service.server.onclose = () => {
                socketOpened = false;
                service.reconnectSocket = $interval(function () {
                    console.log('trying to reconect')
                    socketServer = new WebSocket(SOCKET_PATH);
                    socketServer.onopen = function(){
                        socketOpened = true;
                        window.location.reload()
                    };
                    service.server = socketServer;
                }, SOCKET_RECONECT_INTERVAL)
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
