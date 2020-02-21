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
        service.playedTime = 0;
        service.alarmsInterval = undefined;
        service.reconnectSocket = null;



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
        service.getOutdoorLocationTags = (location, tags) => {
            return tags.filter(t => !location.is_inside && service.isTagInLocation(t, location));
        };

        //controlling if the tag passed as parameter is in the location passed as parameter as well
        service.isTagInLocation = (tag, location) => {
            return service.getTagDistanceFromLocationOrigin(tag, location.position) <= location.radius;
        };

        //calculating the distance of the tag from the location center to see if the tag is in the location area
        service.getTagDistanceFromLocationOrigin = (tag, origin) => {
            if (tag.gps_north_degree !== -2 && tag.gps_east_degree !== -2) {
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
                if (!response.session_state)
                    window.location.reload();

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
                    }, tagAlarmsWindowUpdateTime);

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
                        case 'outside':
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

        // checking if there is at least one tag offline among the passed tags
        service.checkIfTagsAreOffline = (tags) => {
            return tags.some(function (tag) {
                return service.isTagOffline(tag)
            })
        };

        //checking if there is at least an anchor offline
        service.checkIfAnchorsAreOffline = (anchors) => {
            return anchors.some(function (anchor) {
                return anchor.is_offline || anchor.battery_status === 1;
            });
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
        service.fillInfoWindowOutsideLocation = (marker, userTags) => {
            // getting the current marker tags
            let locationTags = service.getOutdoorLocationTags(marker, userTags);

            // filling the info window
            return new google.maps.InfoWindow({
                content: '<div class="marker-info-container">' +
                    '<img src="' + markersIconPath + marker.icon + '" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
                    '<p class="text-center font-large font-bold color-darkcyan">' + marker.name.toUpperCase() + '</p>' +
                    '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + marker.position[0] + '</b></p></div>' +
                    '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + marker.position[1] + '</b></p></div>' +
                    '<div class="clear-float display-flex"><div class="margin-auto"><img src="' + iconsPath + 'offline_tags_alert_30.png" class="margin-right-5-px"><span class="font-large vertical-align-super color-red"><b>' + locationTags.length + '</b></span>' +
                    '</div></div' +
                    '</div>'
            });
        };


        //#####################################################################
        //#                          OUTDOOR FUNCTIONS                        #
        //#####################################################################



        //function that sets an icon image to the marker passed as parameter
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
                        console.log(tagElement)
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
                    }, anchorAlarmsWindowUpdateTime);

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
                        case 'outside':
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
        service.checkIfTagsHaveAlarms = (tags) => {
            return tags.some(function (tag) {
                return tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                    || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                    || tag.call_me_alarm || tag.diagnostic_request || tag.inside_zone;
            })
        };

        // checking if any of the the passed tags have at least one alarm
        service.checkIfTagsHaveAlarmsInfo = (tags) => {
            return tags.some(function (tag) {
                return tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                    || tag.battery_status || tag.man_in_quote || tag.call_me_alarm || tag.diagnostic_request || tag.inside_zone;
            })
        };

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

        //function that plays the alarms audio of the tags passed as parameter
        service.playAlarmsAudio = (tags) => {
            let audio;

            // incrementing the number after which the next play is going to happen
            service.playedTime++;

            // getting the allarms to be played
            tags.forEach(function (tag) {
                if (tag.battery_status) {
                    // control if the alarm is already considered, if not I add it to the allarms to play
                    if (!controlIfAlarmIsInArray(service.alarmsSounds, tag.name, 'battery')) {
                        service.alarmsSounds.push({tag: tag.name, alarm: 'battery'});
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
            }

            // play the alarm
            if (audio !== undefined && service.playedTime > 4 && (service.switch && service.switch.playAudio)){
                audio.play();
                service.playedTime = 0;
            }

            // if the alarm audio is disabled playTime will increase forever sow I reset it
            if (service.playedTime > 5)
                service.playedTime = 0
        };

        //checking if the tag has an alarm
        service.checkIfTagHasAlarm = (tag) => {
            return tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                || tag.battery_status || tag.man_down_disabled || tag.man_down_tacitated || tag.man_in_quote
                || tag.call_me_alarm || tag.diagnostic_request;
        };

        let isCategoryAndImageNotNull = (tag) => {
            return tag.category_id !== null && tag.icon_name_alarm && tag.icon_name_no_alarm !== null;
        };

        //function that returs the images of the alarms of the tags passed as parameter
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
            return tags.some(t => t.gps_north_degree === -1 && t.gps_east_degree && service.checkIfTagHasAlarm(t));
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

        service.isElementAtClick = (virtualTagPosition, mouseDownCoords, distance) => {
            return ((virtualTagPosition.width - distance) < mouseDownCoords.x && mouseDownCoords.x < (virtualTagPosition.width + distance)) && ((virtualTagPosition.height - distance) < mouseDownCoords.y && mouseDownCoords.y < (virtualTagPosition.height + distance));
        };

        service.isTagOffline = (tag) => {
            return ((tag.gps_north_degree !== 0 && tag.gps_east_degree !== 0) && !tag.radio_switched_off && (((Date.now() - new Date(tag.gps_time)) > tag.sleep_time_outdoor)))
                || ((tag.gps_north_degree === 0 && tag.gps_east_degree === 0) && !tag.radio_switched_off && (((Date.now() - new Date(tag.time)) > tag.sleep_time_indoor)));

        };

        service.showAlarms = () => {}
    }

    newSocketService.$inject = ['$state', '$interval'];
    function newSocketService($state, $interval) {
        let service              = this;
        let id = 0;
        service.server               = socketServer;
        service.socketClosed = false;
        service.callbacks = [];

        service.getData = (action, data, callback) => {
            let userData = {};
            if (action !== 'login') {
                data.username = sessionStorage.user;
            }
            userData = data;
            // console.log('after data: ' + userData);
            let stringifyedData = JSON.stringify({action: action, data: userData});

            if (socketOpened) {
                service.server.send(stringifyedData);
                service.callbacks.push({id: id, value: callback});
                $interval.cancel(service.reconnectSocket);
            }

            service.server.onmessage = (response) => {
                let result = JSON.parse(response.data);
                let call = service.callbacks.shift();
                call.value(result);
            };

            service.server.onerror = (error) => {
                let call = service.callbacks.shift();
                call.value('error');
            };

            service.server.onclose = () => {
                $state.go('login');
                service.socketClosed = true;
                service.reconnectSocket = $interval(function () {
                    console.log('trying to reconect')
                    socketServer = new WebSocket('ws://localhost:8090');
                    service.server = socketServer
                }, 5000)
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
