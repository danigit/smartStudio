(function() {
    'use strict';

    angular.module('main').controller('canvasController', canvasController);

    /**
     * Function that handles the canvas interaction including:
     * * tags management
     * * anchors management
     * * cameras management
     * * drawings management
     * @type {string[]}
     */
    canvasController.$inject = ['$rootScope', '$scope', '$state', '$mdDialog', '$timeout', '$interval', '$mdSidenav', 'canvasData', 'dataService', 'newSocketService', '$mdToast', 'canvasService'];

    function canvasController($rootScope, $scope, $state, $mdDialog, $timeout, $interval, $mdSidenav, canvasData, dataService, newSocketService, $mdToast, canvasService) {
        let canvasCtrl = this;
        let canvas = document.querySelector('#canvas-id');
        let context = canvas.getContext('2d');
        let bufferCanvas = document.createElement('canvas');
        let bufferContext = bufferCanvas.getContext('2d');
        let canvasImage = new Image();
        let tags = [];
        let mouseDownCoords = null;
        let prevClick = null;
        let drawAnchorImage = null;
        let dropAnchorPosition = null;
        let dragingStarted = 0;
        let drawedLines = [];
        let drawedZones = [];
        let zones = null;
        let newBegin = [];
        let newEnd = [];
        let anchorToDrop = '';
        let zoneToModify = undefined;
        let alpha = canvasData.alpha;
        let cloudAndSinle = [];

        $scope.showPartnerLogo = SHOW_PARTNER_LOGO;

        canvasCtrl.isAdmin = dataService.isAdmin;
        canvasCtrl.isUserManager = dataService.isUserManager;
        canvasCtrl.isTracker = dataService.isTracker;
        canvasCtrl.floors = dataService.floors;
        canvasCtrl.showAlarmsIcon = false;
        canvasCtrl.showOfflineTagsIcon = false;
        canvasCtrl.showOfflineAnchorsIcon = false;
        canvasCtrl.drawingImage = 'horizontal-line.png';
        canvasCtrl.legend = [];
        canvasCtrl.socketOpened = socketOpened;
        canvasCtrl.zonesFull = false;

        // setting the default floor
        canvasService.setDefaultFloor(canvasCtrl);

        //floor initial data
        canvasCtrl.floorData = {
            defaultFloorName: canvasCtrl.defaultFloor[0].name,
            gridSpacing: canvasCtrl.defaultFloor[0].map_spacing,
            location: (dataService.locationFromClick === '') ? dataService.location.name : dataService.locationFromClick,
            floor_image_map: canvasCtrl.defaultFloor[0].image_map,
            floorZones: []
        };

        // setting the actions button (draw, delete, etc.)
        canvasCtrl.speedDial = {
            isOpen: false,
            selectedDirection: 'left',
            mode: 'md-scale',
            clickedButton: 'horizontal'
        };

        // setting the menu switch buttons
        canvasCtrl.switch = {
            showDrawing: false,
        };

        // loading the image for the default floor
        canvasImage.src = floorPath + canvasCtrl.floorData.floor_image_map;

        // loading loading the user settings
        dataService.loadUserSettings();

        //watching for changes in switch buttons in menu
        $scope.$watchGroup(['canvasCtrl.floorData.gridSpacing', 'canvasCtrl.switch.showDrawing'], function(newValues) {

            //setting the floor spacing in the slider
            if (canvasCtrl.defaultFloor[0].map_spacing !== newValues[0])
                canvasCtrl.defaultFloor[0].map_spacing = newValues[0];

            //showing drawing mode
            if (newValues[1] === true) {
                dataService.switch.showAnchors = false;
                dataService.switch.showCameras = false;
                canvasCtrl.showAlarmsIcon = false;
                canvasCtrl.showOfflineTagsIcon = false;
                canvasCtrl.showOfflineAnchorsIcon = false;
                canvasCtrl.showEngineOffIcon = false;
                canvasCtrl.zonesFull = false;
                canvasCtrl.speedDial.clickedButton = 'horizontal';
                canvasCtrl.drawingImage = 'horizontal-line.png';
                drawedZones = [];

                $mdSidenav('left').close();

                dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);

                newSocketService.getData('get_floor_zones', {
                    floor: canvasCtrl.floorData.defaultFloorName,
                    location: canvasCtrl.floorData.location,
                    user: dataService.user.username
                }, (response) => {
                    zones = response.result;
                });

                newSocketService.getData('get_drawing', { floor: canvasCtrl.defaultFloor[0].id }, (response) => {

                    let parsedResponseDrawing = JSON.parse(response.result);
                    drawedLines = (parsedResponseDrawing === null) ? [] : parsedResponseDrawing;

                    if (drawedLines !== null)
                        canvasService.updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, (canvasCtrl.speedDial.clickedButton === 'drop_anchor'));

                    if (zones !== null)
                        zones.forEach((zone) => {
                            canvasService.drawZoneRect({
                                x: zone.x_left,
                                y: zone.y_up,
                                xx: zone.x_right,
                                yy: zone.y_down
                            }, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.color, true, alpha);
                        })
                });
            } else if (newValues[1] === false) {
                if (dataService.canvasInterval === undefined) {
                    constantUpdateCanvas();
                }
            }
        });

        //watching the floor selection button
        $scope.$watch('canvasCtrl.floorData.defaultFloorName', (newValue) => {
            canvasService.changeFloor(canvas, context, canvasCtrl, canvasImage, newValue);

            if (dataService.canvasInterval === undefined) {
                constantUpdateCanvas();
            }
        });

        /**
         * Function that handles the click on the draw button
         * @param button
         */
        canvasCtrl.speedDialClicked = (button) => {
            switch (button) {
                case 'drop_anchor':
                    {
                        canvasCtrl.drawingImage = 'tags/online_anchor_24.png';

                        // updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, false);
                        canvasService.updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, true);

                    }
                    break;
                case 'vertical':
                    {
                        canvasCtrl.drawingImage = 'vertical-line.png';
                    }
                    break;
                case 'horizontal':
                    {
                        canvasCtrl.drawingImage = 'horizontal-line.png';
                    }
                    break;
                case 'inclined':
                    {
                        canvasCtrl.drawingImage = 'inclined_line.png';
                    }
                    break;
                case 'delete':
                    {
                        canvasCtrl.drawingImage = 'erase_line.png';
                    }
                    break;
                case 'draw_zone':
                    {
                        canvasCtrl.drawingImage = 'draw_zone.png'
                    }
                    break;
                case 'delete_zone':
                    {
                        canvasCtrl.drawingImage = 'delete_zone.png'
                    }
                    break;
                case 'modify_zone':
                    {
                        canvasCtrl.drawingImage = 'modify_zone.png'
                    }

            }

            canvasCtrl.speedDial.clickedButton = button;
        };

        //function that loads the floor map and starts the constant update of the floor
        canvasCtrl.loadFloor = () => {

            canvasImage.onload = function() {
                canvas.width = this.naturalWidth;
                canvas.height = this.naturalHeight;

                //updating the canvas and drawing border
                canvasService.updateCanvas(canvas.width, canvas.height, context, canvasImage);
            };

            //constantly updating the canvas
            if (dataService.canvasInterval === undefined)
                constantUpdateCanvas();

        };

        newSocketService.getData('get_tag_categories', {}, (response) => {

            if (response.result.length > 0) {
                response.result.forEach((category) => {
                    canvasCtrl.legend.push({ name: category.name, img: category.no_alarm_image });
                });
            } else {
                // $mdToast.show({
                //     hideDelay: TOAST_SHOWING_TIME,
                //     position: 'botom center',
                //     controller: 'toastController',
                //     bindToController: true,
                //     locals: {
                //         message: lang.impossibleRecoverTagCategories,
                //         background: 'background-darkred',
                //         color: 'color-white'
                //     },
                //     templateUrl: componentsPath + 'toast.html'
                // });
            }
        });

        //constantly updating the canvas with the objects position from the server
        let constantUpdateCanvas = () => {
            let alarmsCounts = new Array(100).fill(0);
            let isTimeRestInError = false;
            let newLavoration = null;
            let color = TIME_REST_COLOR_OK;
            let description = TIME_REST_DESCRIPTION_OK;
            let visibleTags = [];
            let tagClouds = [];
            let singleTags = [];
            let canvasDrawned = false;
            let orderedZones = [];
            
            canvasService.setDefaultFloor(canvasCtrl);
            canvasService.changeFloor(canvas, context, canvasCtrl, canvasImage, dataService.defaultFloorName);

            // starting the continuous update of the canvas
            dataService.canvasInterval = $interval(function() {

                if (DEBUG)
                    console.log('updating the canvas...');

                // controlling if the socket is opened
                canvasCtrl.socketOpened = socketOpened;

                // setting the canvas width and height
                bufferCanvas.width = canvasImage.naturalWidth;
                bufferCanvas.height = canvasImage.naturalHeight;

                

                // getting all the tags
                newSocketService.getData('get_all_tags', {}, (response) => {
                    if(response.result.length > 0 ) dataService.allTags = response.result;

                    let onTags = response.result.filter(t => !t.radio_switched_off);

                    newSocketService.getData('get_all_locations', {}, (locations) => {
                        if(locations.result.length > 0) dataService.allLocations = locations.result;

                        dataService.showAlarmsIcon(onTags, locations).then((res) => {
                            canvasCtrl.showAlarmsIcon = res;
                        });

                        dataService.getUserTags().then((userTags) => {
                            let onTags = userTags.filter(t => !t.radio_switched_off);

                            //showing the offline tags alarm icon
                            canvasCtrl.showOfflineTagsIcon = dataService.checkIfTagsAreOffline(onTags);

                            // playing the alarms if any
                            dataService.playAlarmsAudio(userTags);
                        });

                        tags = response.result;
                        
                        // getting all the floors of the logged user
                        newSocketService.getData('get_floors_by_user', { user: dataService.user.username }, (floorsByUser) => {

                            if(floorsByUser.result.length > 0) dataService.userFloors = floorsByUser.result;

                            // getting all the floors of the location
                            newSocketService.getData('get_floors_by_location', { location: canvasCtrl.floorData.location }, (floorsByLocation) => {

                                // settuing the local location floor with the ones on the database
                                if(floorsByLocation.result.length > 0) dataService.locationFloors = floorsByLocation.result;
                                canvasCtrl.floors = floorsByLocation.result;

                                let fullZoneFounded = false;
                                floorsByLocation.result.forEach(f => {
                                    newSocketService.getData('get_floor_zones', {floor: f.name, location: canvasCtrl.floorData.location, user: dataService.user.username}, floorZones => {
                                        if (floorZones.result.some(z => z.max_people_active === 1 && z.max_people_alert === 1)){

                                            canvasCtrl.zonesFull = true;
                                            fullZoneFounded = true;
                                        } else if(!fullZoneFounded){
                                            canvasCtrl.zonesFull = false;
                                        }
                                    })
                                })

                                // getting the drawings
                                newSocketService.getData('get_drawing', { floor: canvasCtrl.defaultFloor[0].id }, (drawings) => {

                                    // parsing the draw format
                                    let parsedDraw = JSON.parse(drawings.result);

                                    // controlling if there are drawings
                                    if (parsedDraw !== null && parsedDraw.length > 0) {

                                        // drawing the lines
                                        parsedDraw.forEach((line) => {
                                            canvasService.drawLine(line.begin, line.end, line.type, bufferContext, canvasCtrl.switch.showDrawing);
                                        });
                                    }

                                    // getting the floor zones
                                    newSocketService.getData('get_floor_zones', {
                                        floor: canvasCtrl.floorData.defaultFloorName,
                                        location: canvasCtrl.floorData.location,
                                        user: dataService.user.username
                                    }, (floorZones) => {
                                        // getting the div where to show the headers of the working zones
                                        if(floorZones.result.length > 0) dataService.floorZones = floorZones.result;

                                        let workingZones = document.getElementById('working-zones');
                                        let angularWorkingZones = angular.element(workingZones);

                                        // controlling if there are zones to be drawned
                                        if (floorZones.result.length > 0 && dataService.switch.showZones) {
                                            canvasCtrl.floorData.floorZones = floorZones.result;

                                            // ordering the zones according to the priority of each one
                                            orderedZones = floorZones.result.sort((z1, z2) => (z1.priority < z2.priority) ? 1 : -1);
                                            
                                            // ordering the zones in the header according to the header order of each one
                                            let headerSortedZones = floorZones.result.filter(z => z.work_process_id !== null)
                                                .sort((z1, z2) => (z1.header_order > z2.header_order) ? 1 : -1);


                                            // remove the headers from the page
                                            angular.element(Array.prototype.slice.call(document.querySelectorAll('.lavoration'))).remove();

                                            // appending the new ones
                                            headerSortedZones.forEach((zone, index) => {
                                                if (zone.work_process_id !== 6 && isTimeRestInError) {
                                                    newSocketService.getData('set_zoneA_and_zoneB', {
                                                        work_id: 6,
                                                        zone_id: zone.id
                                                    }, (response) => {
                                                        if (response.result === 0) {
                                                            $mdToast.show({
                                                                hideDelay: TOAST_SHOWING_TIME,
                                                                position: 'bottom center',
                                                                controller: 'toastController',
                                                                bindToController: true,
                                                                locals: {
                                                                    message: lang.headerZonesNotSetted,
                                                                    background: 'background-darkred',
                                                                    color: 'color-white'
                                                                },
                                                                templateUrl: componentsPath + 'toast.html'
                                                            });
                                                        }
                                                    });
                                                }
                                                let side = zone.header_left_side ? "left; margin-left: 35px;" : "right; margin-right: 90px";
                                                let newLavoration = angular.element('<div class="lavoration" style="font-size: small; bottom: 0; padding: 10px 10px 0 10px; ' +
                                                    'background: ' + zone.process_color + '; border-radius: 10px 10px 0 0; float: ' + side + '; text-align: center; color:' + zone.font_color + '">' +
                                                    '<span style="font-weight: bold; text-decoration: underline; color:' + zone.font_color + '">' + zone.name.toUpperCase() + '</span>' +
                                                    '<br>' + zone.process_description + '</div>');
                                                angularWorkingZones.append(newLavoration)
                                            })
                                        }

                                        // getting the central headers
                                        newSocketService.getData('get_rtls', {}, (response) => {

                                            // getting the safemon element
                                            angular.element(document.querySelector('.rtls-mon')).remove();
                                            //getting the time rest element
                                            angular.element(document.querySelector('.rtls-time-rest')).remove();

                                            // showing the safemon header
                                            if (response.result.is_active_safemon === '1') {
                                                // controlling if the time rest is in error and put safemon in error also
                                                if (!isTimeRestInError) {
                                                    newLavoration = angular.element('<div class="rtls-mon" style="position: absolute; width: 10%; left: 40%; font-size: small; bottom: 0; padding: 10px 10px 3px 10px; background: linear-gradient(to bottom, ' + lightenColor(response.result.color, 30) + ' 15%, ' + response.result.color + ' 100%); border-radius: 10px 10px 0 0; float: left; text-align: center"><span style="word-break: break-all; font-weight: bold;">' + response.result.description.toUpperCase() + '</span></div>');
                                                } else {
                                                    newLavoration = angular.element('<div class="rtls-mon" style="position: absolute; width: 10%; left: 40%; font-size: small; bottom: 0; padding: 10px 10px 3px 10px; background: linear-gradient(to bottom, ' + lightenColor(TIME_REST_COLOR_ERROR, 30) + ' 5%, ' + TIME_REST_COLOR_ERROR + ' 100%); border-radius: 10px 10px 0 0; float: left; text-align: center"><span style="word-break: break-all; font-weight: bold;">' + lang.invalidAutomation.toUpperCase() + '</span></div>');
                                                }

                                                angularWorkingZones.append(newLavoration)
                                            }

                                            // showing the time rest header
                                            if (response.result.is_active_time_rest === '1') {
                                                // controlling if the time rest is expired
                                                if ((response.result.now_time - response.result.data_time) > TIME_REST) {
                                                    color = TIME_REST_COLOR_ERROR;
                                                    description = TIME_REST_DESCRIPTION_ERROR;
                                                    isTimeRestInError = true;
                                                } else {
                                                    color = TIME_REST_COLOR_OK;
                                                    description = TIME_REST_DESCRIPTION_OK;
                                                    isTimeRestInError = false;
                                                }

                                                // creating the header and put it in the page
                                                let time_rest = angular.element('<div class="rtls-time-rest" style="position: absolute; width: 10%; left: 55%; font-size: small; bottom: 0; padding: 10px 10px 3px 10px; background: linear-gradient(to bottom, ' + lightenColor(color, 30) + ' 5%, ' + color + ' 100%); border-radius: 10px 10px 0 0; float: left; text-align: center"><span style="word-break: break-all; font-weight: bold;">' + description.toUpperCase() + '</span></div>');
                                                angularWorkingZones.append(time_rest)
                                            }
                                        });

                                        // getting all the anchors of the floor and the current location
                                        newSocketService.getData('get_anchors_by_floor_and_location', {
                                            floor: canvasCtrl.floorData.defaultFloorName,
                                            location: canvasCtrl.floorData.location
                                        }, (anchorsByFloorAndLocation) => {

                                            if(anchorsByFloorAndLocation.result.length > 0) dataService.anchors = anchorsByFloorAndLocation.result;

                                            newSocketService.getData('get_cameras_by_floor_and_location', {
                                                floor: canvasCtrl.floorData.defaultFloorName,
                                                location: canvasCtrl.floorData.location
                                            }, (camerasByFloorAndLocation) => {

                                                if(camerasByFloorAndLocation.result.length > 0) dataService.cameras = camerasByFloorAndLocation.result;

                                                // if there are cameras to be drawn i draw them
                                                loadAndDrawImagesOnCanvas(camerasByFloorAndLocation.result, 'cameras', bufferCanvas, bufferContext, dataService.switch.showCameras);

                                                // getting the tags of the floor and the location
                                                newSocketService.getData('get_tags_by_floor_and_location', {
                                                    floor: canvasCtrl.defaultFloor[0].id,
                                                    location: canvasCtrl.floorData.location
                                                }, (tagsByFloorAndLocation) => {

                                                    // deleting the previous canvas, drawing a new one  and drawing border
                                                    canvasService.updateCanvas(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasImage);

                                                    // showing or hiding the grid on the canvas
                                                    if (dataService.switch.showGrid) {
                                                        // drawing the canvas grid
                                                        canvasService.drawDashedLine(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width);
                                                    }

                                                    // if there are anchors to be drawn I drawn them
                                                    loadAndDrawImagesOnCanvas(anchorsByFloorAndLocation.result, 'anchors', bufferCanvas, bufferContext, dataService.switch.showAnchors);
                                                    canvasCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(anchorsByFloorAndLocation.result);

                                                    // drawing the zones on canvas
                                                    canvasCtrl.floorData.floorZones.forEach((zone) => {
                                                        canvasService.drawZoneRect({
                                                            x: zone.x_left,
                                                            y: zone.y_up,
                                                            xx: zone.x_right,
                                                            yy: zone.y_down
                                                        }, bufferContext, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, zone.color, false, zone.name, alpha);
                                                    });

                                                    if(tagsByFloorAndLocation.result.length > 0) dataService.floorTags = tagsByFloorAndLocation.result;

                                                            floorZones.result.forEach(fz => {
                                                                let tagsInZone = 0;

                                                                tagsByFloorAndLocation.result.filter(t => !t.radio_switched_off).forEach(lt => {

                                                                        if (canvasService.isElementInsideZone(lt, fz)){
                                                                            tagsInZone++;
                                                                        }
                                                                })
                                                            })

                                                            // showing the legend button
                                                            canvasCtrl.showCategoriesButton = dataService.hasTagCategory(tagsByFloorAndLocation.result);

                                                            // getting only the turned on tags and the tags that are no superated the second delta T
                                                            visibleTags = tagsByFloorAndLocation.result.filter(t => !t.radio_switched_off && !dataService.hasTagSuperatedSecondDelta(t));

                                                            // creating the clouds
                                                            cloudAndSinle = canvasService.createClouds(visibleTags);

                                                            // separating the single and clouded tags
                                                            tagClouds = cloudAndSinle.clouds;
                                                            singleTags = cloudAndSinle.single;

                                                    // loading the images for the clouds
                                                    let cloudImages = canvasService.loadTagCloudsImages(tagClouds);

                                                    // control if the tags have to be displayed
                                                    if (canvasCtrl.isAdmin || canvasCtrl.isTracker) {
                                                        // drawing the clouds on the canvas
                                                        cloudImages.forEach(function(image, index) {
                                                            if (image !== null) {
                                                                canvasService.drawCloudIcon(tagClouds[index][0], bufferContext, cloudImages[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[index].length);
                                                            }
                                                        });
                                                    }
                                                    // control if the tags have to be displayed
                                                    else if (canvasCtrl.isUserManager && dataService.switch.showOutdoorTags) {
                                                        // drawing the tags only if there is at least one in alarm
                                                        if (dataService.checkIfTagsHaveAlarms(visibleTags)) {
                                                            cloudImages.forEach(function(image, index) {
                                                                if (image !== null) {
                                                                    canvasService.drawCloudIcon(tagClouds[index][0], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[index].length);
                                                                }
                                                            });
                                                        }
                                                    }
                                                    // controll if the user is a generic user and showing anly clouds with alarms
                                                    else if (!(canvasCtrl.isAdmin && canvasCtrl.isTracker && canvasCtrl.isUserManager)){
                                                        cloudImages.forEach(function(image, index) {
                                                            if (image !== null && image.alarm) {
                                                                canvasService.drawCloudIcon(tagClouds[index][0], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[index].length);
                                                            }
                                                        });
                                                    }

                                                    // loading the images for the single tags
                                                    let singleTagsImages = canvasService.loadTagSingleImages(singleTags)

                                                        // controlling if the tags have to be shown
                                                        if (canvasCtrl.isAdmin || canvasCtrl.isTracker) {
                                                            singleTags.forEach((tag, index) => {
                                                                if (dataService.checkIfTagHasAlarmNoBattery(tag)) {
                                                                    canvasService.loadAlarmImages(dataService.getTagAlarms(tag), (alarms) => {
                                                                        if (alarmsCounts[index] > alarms.length - 1)
                                                                            alarmsCounts[index] = 0;

                                                                        canvasService.drawIcon(tag, bufferContext, alarms[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);

                                                                        // drawing the canvas if not already drawned and if all the tag icons have been drawned on the canvas
                                                                        context.drawImage(bufferCanvas, 0, 0);
                                                                        canvasDrawned = true;
                                                                    });
                                                                }
                                                                // drawing the tag without alarm
                                                                else {
                                                                    if (tag.battery_status && dataService.hasTagReaperedAfterOffline(tag)) {
                                                                        let img = new Image();
                                                                        img.src = tagsIconPath + 'offline_tag_24.png';
                                                                        canvasService.drawIcon(tag, bufferContext, img, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                                    } else {
                                                                        canvasService.drawIcon(tag, bufferContext, singleTagsImages[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                                    }
                                                                }
                                                            })
                                                        }
                                                        // controlling if the tags have to be displayed
                                                        else if (canvasCtrl.isUserManager && dataService.checkIfTagsHaveAlarms(visibleTags)) {
                                                            singleTags.forEach((tag, index) => {
                                                                if (dataService.checkIfTagHasAlarm(tag)) {
                                                                    canvasService.loadAlarmImages(dataService.getTagAlarms(tag), (alarms) => {
                                                                        if (alarmsCounts[index] > alarms.length - 1)
                                                                            alarmsCounts[index] = 0;

                                                                        canvasService.drawIcon(tag, bufferContext, alarms[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                                        context.drawImage(bufferCanvas, 0, 0);
                                                                        canvasDrawned = true;
                                                                    });
                                                                }
                                                                // drawing the tag without alarm
                                                                else if (dataService.switch.showOutdoorTags){
                                                                    canvasService.drawIcon(tag, bufferContext, singleTagsImages[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                                    context.drawImage(bufferCanvas, 0, 0);
                                                                    canvasDrawned = true;
                                                                }
                                                            })
                                                        }
                                                        // controlling if the user is a generic user and showing anly the alarm tags
                                                        else if (!(canvasCtrl.isAdmin && canvasCtrl.isTracker && canvasCtrl.isUserManager)){
                                                            singleTags.forEach((tag, index) => {
                                                                if (dataService.checkIfTagHasAlarmNoBattery(tag)) {
                                                                    canvasService.loadAlarmImages(dataService.getTagAlarms(tag), (alarms) => {
                                                                        if (alarmsCounts[index] > alarms.length - 1)
                                                                            alarmsCounts[index] = 0;

                                                                        canvasService.drawIcon(tag, bufferContext, alarms[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                                        context.drawImage(bufferCanvas, 0, 0);
                                                                        canvasDrawned = true;
                                                                    });
                                                                }
                                                            });
                                                        }
                                                        // controlling if the canvas has been already drawned, if not I drawn it
                                                        if (!canvasDrawned) {
                                                            context.drawImage(bufferCanvas, 0, 0);
                                                        }
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                    canvasDrawned = false;
                });

                newSocketService.getData('get_engine_on', {}, (response) => {
                    if (response.result.version != undefined)
                        dataService.controlVersion(response.result.version)
                    canvasCtrl.showEngineOffIcon = response.result.time_le === undefined;
                });
            }, CANVAS_UPDATE_TIME_INTERVAL);
        };

        $rootScope.$on('constantUpdateCanvas', function() {
            constantUpdateCanvas();
        });

        canvasCtrl.loadFloor();

        /**
         * Function that draws the anchors on the canvas
         * @param objects
         * @param objectType
         * @param canvas
         * @param context
         * @param hasToBeDrawn
         */
        let loadAndDrawImagesOnCanvas = (objects, objectType, canvas, context, hasToBeDrawn) => {
            // controll if the elements have to be drawned
            if (hasToBeDrawn) {
                // controlling if I have to draw anchors
                if (objectType === 'anchors') {
                    // loading anchors images
                    canvasService.loadAnchorsImages(objects)
                        .forEach(function(image, index) {
                            canvasService.drawIcon(objects[index], context, image.img, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, false);
                        })
                }
                // controlling if I have to draw cameras
                else if (objectType === 'cameras') {
                    // loading the cameras images
                    canvasService.loadCamerasImages(objects)
                        .forEach(function(image, index) {
                            canvasService.drawIcon(objects[index], context, image, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, false);
                        })
                }
            }
        };

        $scope.showFullZones = () => {

            $mdDialog.show({
                templateUrl: componentsPath + 'full_zones.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                controller: ['$scope', function($scope) {
                    
                    $scope.fullZones = [];
                    $scope.tableEmpty = true;

                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order: 'name',
                        limit: 5,
                        page: 1
                    };

                    canvasCtrl.floors.forEach(f => {
                        newSocketService.getData('get_floor_zones', {
                            floor: f.name,
                            location: canvasCtrl.floorData.location,
                            user: dataService.user.username
                        }, (response) => {
                            newSocketService.getData('get_anchors_by_floor_and_location', {
                                floor: f.name,
                                location: canvasCtrl.floorData.location
                            }, (anchors) => {
                                newSocketService.getData('get_tags_by_floor_and_location', {
                                    floor: f.id,
                                    location: canvasCtrl.floorData.location
                                }, floorTags => {
                                    $scope.tableEmpty = response.result.length === 0;

                                    let fullFloorZones = response.result.filter(z => z.max_people_alert === 1 && z.max_people_active === 1);
                                    let typeFiveAnchorInZone = false;

                                    let accessFloorAnchors = anchors.result.filter(a => a.anchor_type_id === 5);
                                    
                                    fullFloorZones.forEach((fz, index) => {

                                        fz.floor_name = f.name;

                                        accessFloorAnchors.forEach(a => {
                                            if (canvasService.isAnchorInZone(a, fz)){
                                                typeFiveAnchorInZone = true;
                                                fz.in_count = a.in_count;
                                                fz.out_count = a.out_count;
                                                fz.inside = a.in_count - a.out_count;
                                            }
                                        })
                                    
                                        if(!typeFiveAnchorInZone){
                                            fz.in_count = '-';
                                            fz.out_count = '-';
                                            fz.inside = floorTags.result.filter(ft => !ft.radio_switched_off && canvasService.isElementInsideZone(ft, fz)).length
                                        }
                                    });
                                    $scope.fullZones.push(...fullFloorZones);
                                })
                            })
                        })
                    })
                    
                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
            })

        }

        //getting the coordinate of the click within respect the canvas
        HTMLCanvasElement.prototype.canvasMouseClickCoords = function(event) {
            let totalOffsetX = 0;
            let totalOffsetY = 0;
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

            return { x: canvasX, y: canvasY }
        };

        //function that save the canvas drawing
        canvasCtrl.saveDrawing = () => {
            let tempDrawZones = [];

            drawedZones.forEach((zone) => {
                // getting the position of the zone
                let topLeft = canvasService.scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.topLeft.x, zone.topLeft.y);
                let bottomRight = canvasService.scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.bottomRight.x, zone.bottomRight.y);

                // getting the zones that have been drawned
                let zonesModified = canvasCtrl.floorData.floorZones.some(z => zone.id === z.id);

                // adding the zone to the other zones that have to be saved on the database
                if (!zonesModified)
                    tempDrawZones.push({ topLeft: topLeft, bottomRight: bottomRight, floor: zone.floor });
            });

            // saving the drawings (lines)
            newSocketService.getData('save_drawing', {
                lines: JSON.stringify(drawedLines),
                floor: canvasCtrl.defaultFloor[0].id,
                zones: tempDrawZones
            }, (response) => {

                // control if the saving generated errors
                if (response.result.length > 0) {
                    $mdToast.show({
                        hideDelay: TOAST_SHOWING_TIME,
                        position: 'botom center',
                        controller: 'toastController',
                        bindToController: true,
                        locals: { message: lang.drawingNotSaved, background: 'background-darkred', color: 'color-white' },
                        templateUrl: componentsPath + 'toast.html'
                    });
                }
                // if there are no error on saving the drawings i update the anchors position
                else {

                    let scaledAnchorPosition = [];
                    let drawAnchor = [];

                    //TODO update anchors only if there is at least one anchor modified
                    dataService.anchorsToUpdate.forEach((anchor) => {
                        let scaledSize = { width: anchor.x_pos, height: anchor.y_pos };
                        scaledAnchorPosition.push(scaledSize);
                        drawAnchor.push(anchor.id);
                    });

                    // saving the modified anchors on the database
                    newSocketService.getData('update_anchor_position', {
                        position: scaledAnchorPosition,
                        id: drawAnchor,
                        floor: canvasCtrl.floorData.defaultFloorName
                    }, (updatedAnchors) => {
                        // controlling if the updating generated errors
                        if (updatedAnchors.result.length === 0) {
                            $mdToast.show({
                                hideDelay: TOAST_SHOWING_TIME,
                                position: 'bottom center',
                                controller: 'toastController',
                                bindToController: true,
                                locals: { message: lang.drawingSaved, background: 'background-lightgreen', color: 'color-black' },
                                templateUrl: componentsPath + 'toast.html'
                            });

                            $timeout(function() {
                                dataService.switch.showAnchors = true;
                                dataService.switch.showCameras = true;
                                canvasCtrl.switch.showDrawing = false;

                                dropAnchorPosition = null;
                                drawAnchorImage = null;
                                canvasCtrl.speedDial.clickedButton = '';

                                dataService.anchorsToUpdate = [];
                                if (dataService.canvasInterval === undefined) constantUpdateCanvas();
                            }, CANVAS_DRAWING_ACTION_DELAY);
                        } else {
                            $mdToast.show({
                                hideDelay: TOAST_SHOWING_TIME,
                                position: 'bottom center',
                                controller: 'toastController',
                                bindToController: true,
                                locals: { message: lang.drawingNotSaved, background: 'background-darkred', color: 'color-white' },
                                templateUrl: componentsPath + 'toast.html'
                            });
                        }
                    });
                }
            });
        };

        canvasCtrl.cancelDrawing = () => {
            $mdToast.show({
                hideDelay: TOAST_SHOWING_TIME,
                position: 'bottom center',
                controller: 'toastController',
                bindToController: true,
                locals: { message: lang.actionCanceled, background: 'background-darkred', color: 'color-white' },
                templateUrl: componentsPath + 'toast.html'
            });

            $timeout(function() {
                dataService.switch.showAnchors = true;
                dataService.switch.showCameras = true;
                canvasCtrl.switch.showDrawing = false;

                dropAnchorPosition = null;
                drawAnchorImage = null;
                canvasCtrl.speedDial.clickedButton = '';
                if (dataService.canvasInterval === undefined) constantUpdateCanvas();
            }, CANVAS_DRAWING_ACTION_DELAY);
        };

        //handeling the canvas click
        canvas.addEventListener('mousemove', (event) => {
            if (dataService.switch !== undefined && canvasCtrl.switch.showDrawing) {

                if (canvasCtrl.speedDial.clickedButton !== 'drop_anchor') {
                    canvasService.updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, false);

                    // drawing the old zones
                    canvasService.drawZones(zones, drawedZones, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, true, '', alpha);
                }

                // selecting the thing that I have to draw
                switch (canvasCtrl.speedDial.clickedButton) {
                    // drawing the lines
                    case 'horizontal':
                    case 'vertical':
                    case 'inclined':
                        {

                            if (dragingStarted === 1) {

                                newBegin = canvasService.uniteLinesIfClose(drawedLines, prevClick);

                                canvasService.drawLine(newBegin, canvas.canvasMouseClickCoords(event), canvasCtrl.speedDial.clickedButton, context);
                            }
                        }
                        break;
                        // drawing the new zones
                    case 'draw_zone':
                        {
                            if (dragingStarted === 1) {
                                canvasService.drawZoneRectFromDrawing({
                                    x: prevClick.x,
                                    y: prevClick.y,
                                    xx: canvas.canvasMouseClickCoords(event).x,
                                    yy: canvas.canvasMouseClickCoords(event).y
                                }, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, 'red', alpha);
                            }
                        }
                        break;
                    case 'modify_zone':
                        {
                            // drawing the modified zones
                            if (zoneToModify !== undefined) {
                                drawedZones = drawedZones.filter(z => !angular.equals(zoneToModify, z));
                                zones = zones.filter(z => z.id !== zoneToModify.id);
                                canvasService.drawZoneRectFromDrawing({
                                    x: zoneToModify.bottomRight.x,
                                    y: zoneToModify.bottomRight.y,
                                    xx: canvas.canvasMouseClickCoords(event).x,
                                    yy: canvas.canvasMouseClickCoords(event).y
                                }, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, 'red', alpha);
                            }
                        }
                }
            }
        });

        //handeling the mouse move on the canvas
        canvas.addEventListener('mousedown', function(event) {
            let tagCloud = null;
            let dialogShown = false;
            let realHeight = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;

            // getting the click coordinates
            mouseDownCoords = canvas.canvasMouseClickCoords(event);

            // finding the operation that has to be executed
            switch (canvasCtrl.speedDial.clickedButton) {
                case 'vertical':
                case 'horizontal':
                case 'inclined':
                    {
                        if (canvasCtrl.switch.showDrawing) {
                            dragingStarted++;

                            if (dragingStarted === 1) {
                                // uniting the line with another one if close enoght
                                prevClick = canvasService.uniteLinesIfClose(drawedLines, canvas.canvasMouseClickCoords(event));
                            } else if (dragingStarted === 2) {
                                // setting the line parameters
                                switch (canvasCtrl.speedDial.clickedButton) {
                                    case 'vertical':
                                        {
                                            drawedLines.push({
                                                begin: prevClick,
                                                end: { x: prevClick.x, y: mouseDownCoords.y },
                                                type: canvasCtrl.speedDial.clickedButton
                                            });
                                        }
                                        break;
                                    case 'horizontal':
                                        {
                                            drawedLines.push({
                                                begin: prevClick,
                                                end: { x: mouseDownCoords.x, y: prevClick.y },
                                                type: canvasCtrl.speedDial.clickedButton
                                            });
                                        }
                                        break;
                                    case 'inclined':
                                        {
                                            drawedLines.push({
                                                begin: prevClick,
                                                end: mouseDownCoords,
                                                type: canvasCtrl.speedDial.clickedButton
                                            });
                                        }
                                        break;
                                }
                                dragingStarted = 0;
                            }
                        }
                    }
                    break;
                case 'drop_anchor':
                    {
                        $mdDialog.show({
                            templateUrl: componentsPath + 'select_drop_anchor.html',
                            parent: angular.element(document.body),
                            targetEvent: event,
                            clickOutsideToClose: true,
                            controller: ['$scope', 'dataService', ($scope, dataService) => {
                                $scope.dropAnchor = {
                                    selectedAnchor: ''
                                };

                                newSocketService.getData('get_anchors_by_location', { location: dataService.location.name }, (response) => {

                                    $scope.anchors = response.result;
                                    dataService.locationAnchors = response.result;
                                    $scope.$apply();
                                });

                                $scope.$watch('dropAnchor.selectedAnchor', (newValue) => {
                                    let currentValue = "" + newValue;
                                    if (currentValue !== '') {
                                        anchorToDrop = currentValue;
                                        $mdDialog.hide();

                                        let scaledSize = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, mouseDownCoords.x, mouseDownCoords.y);

                                        let index = dataService.locationAnchors.findIndex(a => a.name === newValue);
                                        let floorAnchorIndex = dataService.anchors.findIndex(a => a.name === newValue);

                                        // controlling if I find the anchor on the floor
                                        if (floorAnchorIndex !== -1) {
                                            dataService.anchors[floorAnchorIndex].x_pos = parseFloat(scaledSize.x);
                                            dataService.anchors[floorAnchorIndex].y_pos = parseFloat(scaledSize.y);
                                            dataService.anchors[floorAnchorIndex].floor_id = canvasCtrl.defaultFloor[0].id;
                                            dataService.anchorsToUpdate.push(dataService.anchors[floorAnchorIndex]);
                                        }
                                        // if the anchor is not on this floor I get it from another floor
                                        else {
                                            dataService.locationAnchors[index].x_pos = parseFloat(scaledSize.x);
                                            dataService.locationAnchors[index].y_pos = parseFloat(scaledSize.y);
                                            dataService.locationAnchors[index].floor_id = canvasCtrl.defaultFloor[0].id;

                                            dataService.anchors.push(dataService.locationAnchors[index]);
                                            dataService.anchorsToUpdate.push(dataService.locationAnchors[index]);
                                        }

                                        updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, (canvasCtrl.speedDial.clickedButton === 'drop_anchor'));
                                    }
                                });
                            }]
                        });
                    }
                    break;
                case 'delete':
                    {
                        // selecting the lines to be removed
                        let toBeRemoved = drawedLines.filter(l => (canvasService.calculateDistance(l.begin.x, l.begin.y, mouseDownCoords.x, mouseDownCoords.y) < LINE_UNION_SPACE) ||
                            (canvasService.calculateDistance(l.end.x, l.end.y, mouseDownCoords.x, mouseDownCoords.y) < LINE_UNION_SPACE));

                        // if there are lines to be removed I remove them
                        if (toBeRemoved.length > 0) {
                            drawedLines = drawedLines.filter(l => !toBeRemoved.some(r => r.begin.x === l.begin.x && r.begin.y === l.begin.y &&
                                r.end.x === l.end.x && r.end.y === l.end.y));

                            canvasService.updateDrawingCanvas([], drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, (canvasCtrl.speedDial.clickedButton === 'drop_anchor'));

                            // drawing the old zones
                            canvasService.drawZones(zones, drawedZones, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, true, alpha);
                        }
                    }
                    break;
                case 'draw_zone':
                    {
                        dragingStarted++;
                        if (dragingStarted === 1) {
                            prevClick = canvas.canvasMouseClickCoords(event);
                        } else if (dragingStarted === 2) {
                            let topLeft = null;
                            let bottomRight = null;
                            //up left
                            if (prevClick.x < mouseDownCoords.x && prevClick.y < mouseDownCoords.y) {
                                drawedZones.push({
                                    topLeft: prevClick,
                                    bottomRight: mouseDownCoords,
                                    floor: canvasCtrl.defaultFloor[0].id
                                });
                            } //up right
                            else if (prevClick.x > mouseDownCoords.x && prevClick.y < mouseDownCoords.y) {
                                topLeft = { x: mouseDownCoords.x, y: prevClick.y };
                                bottomRight = { x: prevClick.x, y: mouseDownCoords.y };
                                drawedZones.push({
                                    topLeft: topLeft,
                                    bottomRight: bottomRight,
                                    floor: canvasCtrl.defaultFloor[0].id
                                });
                            } //down left
                            else if (prevClick.x < mouseDownCoords.x && prevClick.y > mouseDownCoords.y) {
                                topLeft = { x: prevClick.x, y: mouseDownCoords.y };
                                bottomRight = { x: mouseDownCoords.x, y: prevClick.y };
                                drawedZones.push({
                                    topLeft: topLeft,
                                    bottomRight: bottomRight,
                                    floor: canvasCtrl.defaultFloor[0].id
                                });
                            } //down right
                            else if (prevClick.x > mouseDownCoords.x && prevClick.y > mouseDownCoords.y) {
                                drawedZones.push({
                                    topLeft: mouseDownCoords,
                                    bottomRight: prevClick,
                                    floor: canvasCtrl.defaultFloor[0].id
                                });
                            } else {
                                console.log('no case finded');
                            }
                            dragingStarted = 0;
                        }
                    }
                    break;
                case 'modify_zone':
                    {
                        dragingStarted++;

                        if (dragingStarted === 1) {
                            prevClick = canvas.canvasMouseClickCoords(event);
                            zoneToModify = drawedZones.find(z => canvasService.calculateDistance(prevClick.x, prevClick.y, z.topLeft.x, z.topLeft.y) < ZONE_MODIFY_POINT_DIMENSION);

                            let realHeight = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;

                            let virtualPositionTop = null;
                            let virtualPositionBottom = null;

                            let selectedZone = zones.find(z => {
                                virtualPositionTop = scaleIconSize(z.x_left, z.y_up, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                                virtualPositionBottom = scaleIconSize(z.x_right, z.y_down, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);

                                return (canvasService.calculateDistance(prevClick.x, prevClick.y, virtualPositionTop.width, virtualPositionTop.height) < ZONE_MODIFY_POINT_DIMENSION)
                            });

                            if (selectedZone !== undefined) {

                                zoneToModify = {
                                    id: selectedZone.id,
                                    topLeft: { x: virtualPositionTop.width, y: virtualPositionTop.height },
                                    bottomRight: { x: virtualPositionBottom.width, y: virtualPositionBottom.height },
                                    floor: canvasCtrl.defaultFloor[0].id
                                };
                            }
                        }

                        if (zoneToModify === undefined) {
                            dragingStarted = 0;
                        }

                        if (dragingStarted === 2) {
                            if (zoneToModify !== undefined) {
                                if (zoneToModify.id !== undefined) {
                                    let topLeft = null;
                                    let bottomRight = null;
                                    let zoneToLoad = { id: zoneToModify.id, floor: canvasCtrl.defaultFloor[0].id };
                                    if (mouseDownCoords.x < zoneToModify.bottomRight.x && mouseDownCoords.y < zoneToModify.bottomRight.y) {
                                        drawedZones.push(canvasService.createZoneObject(zoneToLoad, mouseDownCoords, zoneToModify.bottomRight))
                                    } else if (mouseDownCoords.x > zoneToModify.bottomRight.x && mouseDownCoords.y < zoneToModify.bottomRight.y) {
                                        topLeft = { x: zoneToModify.bottomRight.x, y: mouseDownCoords.y };
                                        bottomRight = { x: mouseDownCoords.x, y: zoneToModify.bottomRight.y };
                                        drawedZones.push(canvasService.createZoneObject(zoneToLoad, topLeft, bottomRight));
                                    } else if (mouseDownCoords.x < zoneToModify.bottomRight.x && mouseDownCoords.y > zoneToModify.bottomRight.y) {
                                        topLeft = { x: mouseDownCoords.x, y: zoneToModify.bottomRight.y };
                                        bottomRight = { x: zoneToModify.bottomRight.x, y: mouseDownCoords.y };
                                        drawedZones.push(canvasService.createZoneObject(zoneToLoad, topLeft, bottomRight));
                                    } else if (mouseDownCoords.x > zoneToModify.bottomRight.x && mouseDownCoords.y > zoneToModify.bottomRight.y) {
                                        drawedZones.push(canvasService.createZoneObject(zoneToLoad, zoneToModify.bottomRight, mouseDownCoords, bottomRight));
                                    }

                                    let modifiedZone = drawedZones.find(z => z.id === zoneToModify.id);

                                    let topLeftScaled = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, modifiedZone.topLeft.x, modifiedZone.topLeft.y);
                                    let bottomDownScalled = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, modifiedZone.bottomRight.x, modifiedZone.bottomRight.y);

                                    newSocketService.getData('update_floor_zone', {
                                        zone_id: zoneToModify.id,
                                        x_left: topLeftScaled.x,
                                        x_right: bottomDownScalled.x,
                                        y_up: topLeftScaled.y,
                                        y_down: bottomDownScalled.y
                                    }, (response) => {
                                        if (response.result !== 1) {
                                            $mdToast.show({
                                                hideDelay: TOAST_SHOWING_TIME,
                                                position: 'bottom center',
                                                controller: 'toastController',
                                                bindToController: true,
                                                locals: {
                                                    message: lang.zoneFloorUpdated,
                                                    background: 'background-lightgreen',
                                                    color: 'color-black'
                                                },
                                                templateUrl: componentsPath + 'toast.html'
                                            });
                                        } else {
                                            // TODO show all the toast from a function
                                            $mdToast.show({
                                                hideDelay: TOAST_SHOWING_TIME,
                                                position: 'bottom center',
                                                controller: 'toastController',
                                                bindToController: true,
                                                locals: {
                                                    message: lang.zoneFloorNotUpdated,
                                                    background: 'background-darkred',
                                                    color: 'color-white'
                                                },
                                                templateUrl: componentsPath + 'toast.html'
                                            });
                                        }
                                    });
                                } else {
                                    let topLeft = null;
                                    let bottomRight = null;
                                    let zoneToLoad = { floor: canvasCtrl.defaultFloor[0].id };
                                    if (mouseDownCoords.x < zoneToModify.bottomRight.x && mouseDownCoords.y < zoneToModify.bottomRight.y) {
                                        drawedZones.push(canvasService.createZoneObject(zoneToLoad, mouseDownCoords, zoneToModify.bottomRight))
                                    } else if (mouseDownCoords.x > zoneToModify.bottomRight.x && mouseDownCoords.y < zoneToModify.bottomRight.y) {
                                        topLeft = { x: zoneToModify.bottomRight.x, y: mouseDownCoords.y };
                                        bottomRight = { x: mouseDownCoords.x, y: zoneToModify.bottomRight.y };
                                        drawedZones.push(canvasService.createZoneObject(zoneToLoad, topLeft, bottomRight))
                                    } else if (mouseDownCoords.x < zoneToModify.bottomRight.x && mouseDownCoords.y > zoneToModify.bottomRight.y) {
                                        topLeft = { x: mouseDownCoords.x, y: zoneToModify.bottomRight.y };
                                        bottomRight = { x: zoneToModify.bottomRight.x, y: mouseDownCoords.y };
                                        drawedZones.push(canvasService.createZoneObject(zoneToLoad, topLeft, bottomRight))
                                    } else if (mouseDownCoords.x > zoneToModify.bottomRight.x && mouseDownCoords.y > zoneToModify.bottomRight.y) {
                                        drawedZones.push(canvasService.createZoneObject(zoneToLoad, zoneToModify.bottomRight, mouseDownCoords))
                                    }
                                }
                                zoneToModify = undefined;
                            }
                            dragingStarted = 0;
                        }
                    }
                    break;
                case 'delete_zone':
                    {
                        let findedZones = canvasService.findZones(zones, mouseDownCoords, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height);
                        let findedDrawedZones = canvasService.findDrawedZones(drawedZones, mouseDownCoords);

                        if (findedDrawedZones.length !== 0) {
                            drawedZones = drawedZones.filter(z => !findedDrawedZones.some(fz => angular.equals(z, fz)));
                        }

                        if (findedZones.length !== 0) {
                            newSocketService.getData('delete_floor_zones', { zones: findedZones }, (response) => {

                                if (response.result.length === 0) {
                                    $mdToast.show({
                                        hideDelay: TOAST_SHOWING_TIME,
                                        position: 'bottom center',
                                        controller: 'toastController',
                                        bindToController: true,
                                        locals: {
                                            message: lang.zoneFloorDeleted,
                                            background: 'background-lightgreen',
                                            color: 'color-black'
                                        },
                                        templateUrl: componentsPath + 'toast.html'
                                    });
                                    zones = zones.filter(z => !findedZones.some(fz => fz === z.id));
                                } else {
                                    $mdToast.show({
                                        hideDelay: TOAST_SHOWING_TIME,
                                        position: 'bottom center',
                                        controller: 'toastController',
                                        bindToController: true,
                                        locals: {
                                            message: lang.zoneFloorNotDeleted,
                                            background: 'background-darkred',
                                            color: 'color-white'
                                        },
                                        templateUrl: componentsPath + 'toast.html'
                                    });
                                }
                            });
                        }
                    }
            }

            if (!canvasCtrl.switch.showDrawing) {
                //managing the click on the tag icons
                dataService.floorTags.filter(t => !t.radio_switched_off && !dataService.hasTagSuperatedSecondDelta(t)).forEach(function(tag) {
                    // getting the position of the tag
                    let virtualTagPosition = scaleIconSize(tag.x_pos, tag.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                    // getting the group of tags
                    let groupTag = cloudAndSinle.clouds.find(tc => tc.some(t => t.id === tag.id));

                    // controlling if the tags have to be displayed
                    if (canvasCtrl.isAdmin || canvasCtrl.isTracker || (canvasCtrl.isUserManager && dataService.switch.showOutdoorTags)) {
                        // getting the tags at click
                        if (canvasService.isElementAtClick(virtualTagPosition, mouseDownCoords, CANVAS_TAG_ICON_SIZE)) {
                            // controlling if at the click there is a single tag
                            if (groupTag === undefined) {
                                $mdDialog.show({
                                    locals: { tag: tag },
                                    templateUrl: componentsPath + 'tag-info.html',
                                    parent: angular.element(document.body),
                                    targetEvent: event,
                                    clickOutsideToClose: true,
                                    controller: ['$scope', 'tag', function($scope, tag) {
                                        $scope.tag = tag;
                                        $scope.alarms = dataService.loadTagAlarmsForInfoWindow(tag);

                                        $scope.isTagInAlarm = ($scope.alarms.length !== 0) ? 'background-red' : dataService.isTagOffline(tag) ?
                                            'background-darkgray' : 'background-green';

                                        $scope.hide = () => {
                                            $mdDialog.hide();
                                        }
                                    }]
                                })
                            }
                            // control if at the click there is no single tag
                            else if (!canvasService.singleTagAtPosition(cloudAndSinle.single, canvasCtrl.defaultFloor[0].width, canvas, realHeight, mouseDownCoords)) {
                                if (!dialogShown) {
                                    $mdDialog.show({
                                        locals: { tags: groupTag },
                                        templateUrl: componentsPath + 'tags-info.html',
                                        parent: angular.element(document.body),
                                        targetEvent: event,
                                        clickOutsideToClose: true,
                                        controller: ['$scope', 'tags', function($scope, tags) {
                                            $scope.tags = tags;
                                            $scope.isTagInAlarm = (dataService.checkIfTagsHaveAlarms(tags)) ? 'background-red' :
                                                (dataService.checkIfTagsAreOffline(tags)) ? 'background-darkgray' : 'background-green';
                                            $scope.iconPath = { icon: iconsPath };
                                            $scope.collapsibleState = COLLAPSIBLE_STATE;
                                            let tempAlarmTag = [];
                                            let listState = [];

                                            // getting the alarms for each tag
                                            $scope.tags.forEach(tagElem => {
                                                let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tagElem);
                                                tagAlarms.forEach(function(ta) {
                                                    tempAlarmTag.push(ta);
                                                });
                                                listState.push(COLLAPSIBLE_STATE);
                                            });

                                            // showing and hiding the content of the lists
                                            $scope.displayList = (tag, index) => {
                                                if (listState[index]) {
                                                    document.getElementsByClassName('collapse')[index].classList.add('open-slide');
                                                } else {
                                                    document.getElementsByClassName('collapse')[index].classList.remove('open-slide');
                                                }
                                                listState[index] = !listState[index]
                                            };

                                            $scope.alarms = tempAlarmTag;

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    });
                                    dialogShown = true;
                                }
                            }
                        }
                    }
                });
            }
            //managing the click on the anchor icons
            dataService.anchors.forEach(function(anchor) {
                if (!isTagAtCoords(mouseDownCoords, CANVAS_TAG_ICON_SIZE) && !canvasCtrl.switch.showDrawing) {
                    let virtualAnchorPosition = scaleIconSize(anchor.x_pos, anchor.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                    if (dataService.isElementAtClick(virtualAnchorPosition, mouseDownCoords, CANVAS_ANCHOR_ICON_SIZE)) {

                        $mdDialog.show({
                            locals: { anchor: anchor },
                            templateUrl: componentsPath + 'anchor-info.html',
                            parent: angular.element(document.body),
                            targetEvent: event,
                            clickOutsideToClose: true,
                            controller: ['$scope', 'anchor', function($scope, anchor) {
                                $scope.anchor = anchor;
                                $scope.isAnchorOnline = 'background-green';

                                if (anchor.is_offline) {
                                    $scope.isAnchorOnline = 'background-darkgray';
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
            dataService.cameras.forEach(function(camera) {
                if (!isTagAtCoords(mouseDownCoords, CANVAS_TAG_ICON_SIZE) && !canvasCtrl.switch.showDrawing) {
                    let virtualCamerasPosition = scaleIconSize(camera.x_pos, camera.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                    if (dataService.isElementAtClick(virtualCamerasPosition, mouseDownCoords, CANVAS_CAMERA_ICON_SIZE)) {
                        $mdDialog.show({
                            templateUrl: componentsPath + 'video-camera.html',
                            parent: angular.element(document.body),
                            targetEvent: event,
                            clickOutsideToClose: true,
                            controller: ['$scope', function($scope) {
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
        $scope.showAlarms = function() {
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);

            // showing the alarm table
            dataService.showAlarms(constantUpdateCanvas, null, 'canvas')
        };

        /**
         * Function that control if the there is a tag at the coordinates passed as parameter
         * @param coords
         * @param distance
         * @returns {*}
         */
        let isTagAtCoords = (coords, distance) => {
            return dataService.floorTags.filter(t => !t.radio_switched_off && !dataService.hasTagSuperatedSecondDelta(t)).some(function(tag) {
                let realHeight = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;
                let virtualTagPosition = scaleIconSize(tag.x_pos, tag.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                return canvasService.isElementAtClick(virtualTagPosition, coords, distance)
            })
        };

        /**
         * Showing the info window with the online/offline tags
         */
        $scope.showOfflineTagsIndoor = () => {
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);
            dataService.showOfflineTags('canvas', constantUpdateCanvas, null);
        };

        /**
         * Showing the info window with the online/offline anchors
         */
        $scope.showOfflineAnchorsIndoor = () => {
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);
            dataService.showOfflineAnchors('canvas', constantUpdateCanvas, null);
        };

        /**
         * Functionthat handles the emergency zone dialog
         */
        $scope.showEmergencyZone = () => {
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);

            $mdDialog.show({
                locals: { floor: canvasCtrl.defaultFloor[0].name, tags: dataService.floorTags },
                templateUrl: componentsPath + 'emergency-alarm-info.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                controller: ['$scope', 'floor', 'tags', function($scope, floor, tags) {
                    $scope.safeTags = null;
                    $scope.unsafeTags = [];
                    $scope.data = [];
                    $scope.anchors = [];
                    $scope.evacuation_value = lang.initEvacuation;
                    $scope.evacuation_button = 'background-red';
                    $scope.anchorsInfo = {};
                    $scope.totalPresent = 0;
                    $scope.totalZones = 0;
                    $scope.isAnchorsEmpty = 0;
                    $scope.lostTags = [];

                    let evacuation_on = false;

                    $scope.men = {
                        safe: 0,
                        unsafe: 0
                    };

                    $scope.colors = ["#4BAE5A", "#E13044"];
                    $scope.labels = [lang.personInEvacuationZone, lang.lostPersons];

                    // continuously updating the tag situation
                    dataService.emergencyZoneInterval = $interval(function() {

                        if (DEBUG)
                            console.log('updating the emergency zone...');

                        let tempTotalPresent = 0;
                        let tempAnchorTags = [];
                        
                        canvasCtrl.floors.forEach(f => {
                            newSocketService.getData('get_tags_by_floor_and_location', {
                                floor: f.id,
                                location: canvasCtrl.floorData.location
                            }, floorTags => {
                                newSocketService.getData('get_floor_zones', {floor: f.name, location: canvasCtrl.floorData.location, user: dataService.user.username}, floorZones => {
                                    newSocketService.getData('get_anchors_by_floor_and_location', {
                                        floor: f.name,
                                        location: canvasCtrl.floorData.location
                                    }, locationAnchors => {

                                        let emergencyAnchors = locationAnchors.result.filter(a => a.emergency_zone === 1);

                                        if(emergencyAnchors.length === 0){
                                            for (var member in $scope.anchorsInfo) delete $scope.anchorsInfo[member];
                                        }

                                        canvasService.getLocationTags(canvasCtrl.floorData.location).then(tempTotalTags => {
                                            emergencyAnchors.forEach(a => {

                                                let anchorTags = floorTags.result.filter(ft => !ft.radio_switched_off && ft.anchor_id === a.id);
                                                let anchorZone = floorZones.result.find(z => canvasService.isElementInsideZone(a, z));
                                                
                                                tempAnchorTags.push(...anchorTags);

                                                $scope.anchorsInfo[a.id] = {
                                                    anchorName: a.name, 
                                                    anchorFloor: a.floor_name, 
                                                    zone: anchorZone !== undefined ? anchorZone.name : lang.noZone, 
                                                    anchorTags: anchorTags, 
                                                    zoneMax: tempTotalTags.length,
                                                    anchorData: [anchorTags.length, tempTotalTags.length - anchorTags.length],
                                                };
                                                
                                                tempTotalPresent += anchorTags.length;
                                            })

                                            if(Object.keys($scope.anchorsInfo).length !== 0){
                                                $scope.isAnchorsEmpty = 2;
                                            }else{
                                                $scope.isAnchorsEmpty = 1;
                                            }

                                            $scope.lostTags = tempTotalTags.filter(t => !tempAnchorTags.some(tat => tat.id === t.id));
                                            $scope.totalZones = tempTotalTags.length;
                                            $scope.totalPresent = tempTotalPresent;
                                        })

                                    })
                                })
                            })
                        })
                    }, EMERGENCY_WINDOW_UPDATE_TIME);

                    newSocketService.getData('get_evacuation', {}, (response) => {
                        if (response.result == 1) {
                            evacuation_on = true;
                            $scope.evacuation_button = 'background-green';
                            $scope.evacuation_value = lang.reset;
                        } else {
                            $scope.evacuation_on = false;
                            $scope.evacuation_button = 'background-red';
                            $scope.evacuation_value = lang.initEvacuation;
                        }
                    });

                    $scope.sendEvacuation = () => {
                        if (evacuation_on == false) {
                            newSocketService.getData('set_evacuation', {}, (response) => {
                                if (response.result > 0) {
                                    evacuation_on = true;
                                    $scope.evacuation_button = 'background-green';
                                    $scope.evacuation_value = lang.reset;
                                }
                            });
                        } else {
                            newSocketService.getData('stop_evacuation', {}, (response) => {
                                if (response.result > 0) {
                                    evacuation_on = false;
                                    $scope.evacuation_button = 'background-red';
                                    $scope.evacuation_value = lang.initEvacuation;
                                }
                            })
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                // stoping the interva (request for data) when the window closes
                onRemoving: function() {
                    dataService.emergencyZoneInterval = dataService.stopTimer(dataService.emergencyZoneInterval);

                    if (dataService.canvasInterval === undefined)
                        constantUpdateCanvas();
                }
            })
        };

        //function that returns you to home
        canvasCtrl.goHome = () => {
            dataService.goHome();
        };

        //freeing the resources on page destroy
        $scope.$on("$destroy", function() {
            $mdDialog.hide();
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);
        });
    }
})();