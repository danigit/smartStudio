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
    canvasController.$inject = ['$rootScope', '$scope', '$state', '$mdDialog', '$timeout', '$interval', '$mdSidenav', 'canvasData', 'dataService', 'newSocketService', 'canvasService'];

    function canvasController($rootScope, $scope, $state, $mdDialog, $timeout, $interval, $mdSidenav, canvasData, dataService, newSocketService, canvasService) {
        let canvasCtrl         = this;
        let canvas             = document.querySelector('#canvas-id');
        let context            = canvas.getContext('2d');
        let bufferCanvas       = document.createElement('canvas');
        let bufferContext      = bufferCanvas.getContext('2d');
        let canvasImage        = new Image();
        let tags               = [];
        let mouseDownCoords    = null;
        let prevClick          = null;
        let drawAnchorImage    = null;
        let dropAnchorPosition = null;
        let dragingStarted     = 0;
        let drawedLines        = [];
        let drawedZones        = [];
        let zones              = null;
        let newBegin           = [];
        let newEnd             = [];
        let anchorToDrop       = '';
        let zoneToModify       = null;
        let alpha              = canvasData.alpha;

        canvasCtrl.isAdmin                = dataService.isAdmin;
        canvasCtrl.isUserManager          = dataService.isUserManager;
        canvasCtrl.isTracker              = dataService.isTracker;
        canvasCtrl.floors                 = dataService.floors;
        canvasCtrl.showAlarmsIcon         = false;
        canvasCtrl.showOfflineTagsIcon    = false;
        canvasCtrl.showOfflineAnchorsIcon = false;
        canvasCtrl.drawingImage           = 'horizontal-line.png';

        // setting the default floor
        canvasService.setDefaultFloor(canvasCtrl);

        //floor initial data
        canvasCtrl.floorData = {
            defaultFloorName: canvasCtrl.defaultFloor[0].name,
            gridSpacing     : canvasCtrl.defaultFloor[0].map_spacing,
            location        : (dataService.locationFromClick === '') ? dataService.location.name : dataService.locationFromClick,
            floor_image_map : canvasCtrl.defaultFloor[0].image_map,
            floorZones      : []
        };

        // setting the actions button (draw, delete, etc.)
        canvasCtrl.speedDial = {
            isOpen           : false,
            selectedDirection: 'left',
            mode             : 'md-scale',
            clickedButton    : 'horizontal'
        };

        // setting the menu switch buttons
        canvasCtrl.switch = {
            showDrawing   : false,
            showFullscreen: false,
        };

        canvasImage.src = floorPath + canvasCtrl.floorData.floor_image_map;

        // loading loading the user settings
        dataService.loadUserSettings();

        //watching for changes in switch buttons in menu
        // TODO - controll when the fullscren is off from the esc button
        $scope.$watchGroup(['dataService.switch.showGrid', 'dataService.switch.showAnchors', 'dataService.switch.showCameras', 'canvasCtrl.switch.showFullscreen', 'canvasCtrl.floorData.gridSpacing', 'canvasCtrl.switch.showDrawing'], function (newValues) {

            //setting the floor spacing in the slider
            if (canvasCtrl.defaultFloor[0].map_spacing !== newValues[4])
                canvasCtrl.defaultFloor[0].map_spacing = newValues[4];

            //showing the fullscreen if switched
            if (newValues[3]) {
                openFullScreen(document.querySelector('body'));
                $mdSidenav('left').close();
            } else if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement ||
                document.msFullscreenElement) {
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
                canvasCtrl.showEngineOffIcon       = false;
                canvasCtrl.speedDial.clickedButton = 'horizontal';
                canvasCtrl.drawingImage            = 'horizontal-line.png';
                drawedZones                        = [];

                $mdSidenav('left').close();

                dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);

                newSocketService.getData('get_floor_zones', {
                    floor   : canvasCtrl.floorData.defaultFloorName,
                    location: canvasCtrl.floorData.location,
                    user    : dataService.user.username
                }, (response) => {
                    zones = response.result;
                });

                newSocketService.getData('get_drawing', {floor: canvasCtrl.defaultFloor[0].id}, (response) => {
                    if (!response.session_state)
                        window.location.reload();

                    let parsedResponseDrawing = JSON.parse(response.result);
                    drawedLines               = (parsedResponseDrawing === null) ? [] : parsedResponseDrawing;

                    if (drawedLines !== null)
                        updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, (canvasCtrl.speedDial.clickedButton === 'drop_anchor'));

                    if (zones !== null)
                        zones.forEach((zone) => {
                            drawZoneRect({
                                x : zone.x_left,
                                y : zone.y_up,
                                xx: zone.x_right,
                                yy: zone.y_down
                            }, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.color, true, alpha);
                        })
                });
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
            canvasImage.src                       = floorPath + canvasCtrl.floorData.floor_image_map;
            context.clearRect(0, 0, canvas.width, canvas.height);

            if (dataService.canvasInterval === undefined) {
                constantUpdateCanvas();
            }
        });

        //function that handles the click on the drawing buttons
        canvasCtrl.speedDialClicked = (button) => {
            if (button === 'drop_anchor') {
                canvasCtrl.drawingImage = 'tags/online_anchor_24.png';

                // updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, false);
                updateDrawingCanvas(dataService, drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, true);

                // if (dataService.anchors.length > 0) {
                //     console.log('loadAndDrawImageOnCanvas from speedDial');
                //     loadAndDrawImagesOnCanvas(dataService.anchors, 'anchor', canvas, context, true);
                // }
            } else if (button === 'vertical') {
                canvasCtrl.drawingImage = 'vertical-line.png';
            } else if (button === 'horizontal') {
                canvasCtrl.drawingImage = 'horizontal-line.png';
            } else if (button === 'inclined') {
                canvasCtrl.drawingImage = 'inclined_line.png';
            } else if (button === 'delete') {
                canvasCtrl.drawingImage = 'erase_line.png';
            } else if (button === 'draw_zone') {
                canvasCtrl.drawingImage = 'draw_zone.png'
            } else if (button === 'delete_zone') {
                canvasCtrl.drawingImage = 'delete_zone.png'
            } else if (button === 'modify_zone') {
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

        // switching off the fullscreen when closing from esc button
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
                canvasCtrl.switch.showFullscreen = false;
            }
        });

        //constantly updating the canvas with the objects position from the server
        let constantUpdateCanvas = () => {
            let alarmsCounts = new Array(100).fill(0);
            let isTimeRestInError = false;
            let newLavoration = null;
            let color       = TIME_REST_COLOR_OK;
            let description = TIME_REST_DESCRIPTION_OK;
            let visibleTags = [];
            let cloudAndSinle = [];
            let tagClouds = []
            let singleTags = []

            // starting the continuous update of the canvas
            dataService.canvasInterval = $interval(function () {

                // setting the canvas width and height
                bufferCanvas.width  = canvasImage.naturalWidth;
                bufferCanvas.height = canvasImage.naturalHeight;

                // deleting the previous canvas, drawing a new one and the canvas and drawing border
                updateCanvas(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasImage);

                // showing or hiding the grid on the canvas
                if (dataService.switch.showGrid) {
                    console.log(dataService.switch.showGrid)
                    // drawing the canvas grid
                    canvasService.drawDashedLine(bufferCanvas.width, bufferCanvas.height, bufferContext, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width);
                }

                // getting all the tags
                newSocketService.getData('get_all_tags', {}, (response) => {
                    tags = response.result;

                    // playing the alarms if any
                    dataService.playAlarmsAudio(response.result);

                    // getting all the floors of the logged user
                    newSocketService.getData('get_floors_by_user', {user: dataService.user.username}, (floorsByUser) => {

                        dataService.userFloors = floorsByUser.result;

                        // getting all the floors of the location
                        newSocketService.getData('get_floors_by_location', {location: canvasCtrl.floorData.location}, (floorsByLocation) => {

                            // settubg the local location floor with the ones on the database
                            canvasCtrl.floors = floorsByLocation.result;
                            // let tempFloors = floorsByLocation.result;
                            //
                            // if (!angular.equals(canvasCtrl.floors, tempFloors))
                            //     canvasCtrl.floors = floorsByLocation.result;

                            // getting the drawings
                            newSocketService.getData('get_drawing', {floor: canvasCtrl.defaultFloor[0].id}, (drawings) => {

                                // controlling if there are drawings
                                if (drawings.length > 0) {
                                    // parsing the draw format
                                    let parsedDraw = JSON.parse(drawings.result);

                                    // drawing the lines
                                    parsedDraw.forEach((line) => {
                                        drawLine(line.begin, line.end, line.type, bufferContext, canvasCtrl.switch.showDrawing);
                                    });
                                };

                                // getting the floor zones
                                newSocketService.getData('get_floor_zones', {
                                    floor   : canvasCtrl.floorData.defaultFloorName,
                                    location: canvasCtrl.floorData.location,
                                    user    : dataService.user.username
                                }, (floorZones) => {
                                    // getting the div where to show the headers of the working zones
                                    let workingZones        = document.getElementById('working-zones');
                                    let angularWorkingZones = angular.element(workingZones);

                                    // controlling if there are zones to be drawned
                                    if (floorZones.result.length > 0 && dataService.switch.showZones) {
                                        canvasCtrl.floorData.floorZones = floorZones.result;

                                        // ordering the zones according to the priority of each one
                                        let orderedZones                = floorZones.result.sort((z1, z2) => (z1.priority < z2.priority) ? 1 : -1);
                                        // drawing the zones
                                        orderedZones.forEach((zone) => {
                                            drawZoneRect({
                                                x : zone.x_left,
                                                y : zone.y_up,
                                                xx: zone.x_right,
                                                yy: zone.y_down
                                            }, bufferContext, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, zone.color, false, alpha);
                                        });

                                        // ordering the zones in the header according to the header order of each one
                                        let headerSortedZones = floorZones.result.filter(z => z.work_process_id !== null)
                                            .sort((z1, z2) => (z1.header_order > z2.header_order) ? 1 : -1);


                                        // remove the headers from the page
                                        angular.element(Array.prototype.slice.call(document.querySelectorAll('.lavoration'))).remove();

                                        // appending the new ones
                                        headerSortedZones.forEach((zone, index) => {
                                            if (zone.work_process_id !== 6 && isTimeRestInError){
                                                newSocketService.getData('set_zoneA_and_zoneB', {work_id: 6, zone_id: zone.id}, (response) => {
                                                });
                                            }
                                            let side          = zone.header_left_side ? "left; margin-left: 35px;" : "right; margin-right: 90px";
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
                                            if (!isTimeRestInError){
                                                newLavoration = angular.element('<div class="rtls-mon" style="position: absolute; width: 200px; left: 38%; font-size: small; bottom: 0; padding: 10px 10px 0 10px; background: ' + response.result.color + '; border-radius: 10px 10px 0 0; float: left; text-align: center"><span style="word-break: break-all; font-weight: bold;">' + response.result.description.toUpperCase() + '</span></div>');
                                            } else{
                                                newLavoration = angular.element('<div class="rtls-mon" style="position: absolute; width: 200px; left: 38%; font-size: small; bottom: 0; padding: 10px 10px 0 10px; background: #FF0000; border-radius: 10px 10px 0 0; float: left; text-align: center"><span style="word-break: break-all; font-weight: bold;">' + lang.invalidAutomation.toUpperCase() + '</span></div>');
                                            }

                                            angularWorkingZones.append(newLavoration)
                                        }

                                        // showing the time rest header
                                        if (response.result.is_active_time_rest === '1') {
                                            // controlling if the time rest is expired
                                            if ((response.result.now_time - response.result.data_time) > TIME_REST) {
                                                color       = TIME_REST_COLOR_ERROR;
                                                description = TIME_REST_DESCRIPTION_ERROR;
                                            } else {
                                                color       = TIME_REST_COLOR_OK;
                                                description = TIME_REST_DESCRIPTION_OK;
                                            }

                                            // creating the header and put it in the page
                                            let time_rest = angular.element('<div class="rtls-time-rest" style="position: absolute; width: 200px; left: 53%; font-size: small; bottom: 0; padding: 10px 10px 0 10px; background: ' + color + '; border-radius: 10px 10px 0 0; float: left; text-align: center"><span style="word-break: break-all; font-weight: bold;">' + description.toUpperCase() + '</span></div>');
                                            angularWorkingZones.append(time_rest)
                                        }
                                    });

                                    // getting all the anchors of the floor and the current location
                                    newSocketService.getData('get_anchors_by_floor_and_location', {
                                        floor   : canvasCtrl.floorData.defaultFloorName,
                                        location: canvasCtrl.floorData.location
                                    }, (anchorsByFloorAndLocation) => {

                                        dataService.anchors = anchorsByFloorAndLocation.result;

                                        // if there are anchors to be drawn I drawn them
                                        if (anchorsByFloorAndLocation.result.length > 0) {
                                            loadAndDrawImagesOnCanvas(anchorsByFloorAndLocation.result, 'anchor', bufferCanvas, bufferContext, dataService.switch.showAnchors);
                                            canvasCtrl.showOfflineAnchorsIcon = dataService.checkIfAnchorsAreOffline(anchorsByFloorAndLocation.result);
                                        }

                                        // getting the cameras for the floor and the location
                                        newSocketService.getData('get_cameras_by_floor_and_location', {
                                            floor   : canvasCtrl.floorData.defaultFloorName,
                                            location: canvasCtrl.floorData.location
                                        }, (camerasByFloorAndLocation) => {

                                            dataService.cameras = camerasByFloorAndLocation.result;

                                            // if there are cameras to be drawn i draw them
                                            if (camerasByFloorAndLocation.result.length > 0)
                                                loadAndDrawImagesOnCanvas(camerasByFloorAndLocation.result, 'camera', bufferCanvas, bufferContext, dataService.switch.showCameras);

                                            // getting the tags of the floor and the location
                                            newSocketService.getData('get_tags_by_floor_and_location', {
                                                floor   : canvasCtrl.defaultFloor[0].id,
                                                location: canvasCtrl.floorData.location
                                            }, (tagsByFloorAndLocation) => {

                                                dataService.floorTags = tagsByFloorAndLocation.result;

                                                let tagClouds            = [];
                                                let isolatedTags         = [];
                                                let singleAndGroupedTags = [];
                                                let contextDrawed        = false;

                                                let temporaryTagsArray = {
                                                    singleTags: angular.copy(tagsByFloorAndLocation.result),
                                                };
                                                
                                                visibleTags = tagsByFloorAndLocation.result.filter(t => !t.radio_switched_off);
                                                cloudAndSinle = canvasService.createClouds(visibleTags);

                                                tagClouds = cloudAndSinle.clouds;
                                                singleTags = cloudAndSinle.single;

                                                // for (let i = 0; i < temporaryTagsArray.singleTags.length;) {
                                                //     //getting the near tags of the tag passed as second parameter
                                                //     if (temporaryTagsArray.singleTags.length > 0) {
                                                //         let currentTag     = temporaryTagsArray.singleTags[0];
                                                //         temporaryTagsArray = dataService.groupNearTags(temporaryTagsArray.singleTags, temporaryTagsArray.singleTags[0]);
                                                //
                                                //         if (temporaryTagsArray.groupTags.length === 1) {
                                                //             isolatedTags.push(temporaryTagsArray.groupTags[0])
                                                //         } else if (temporaryTagsArray.groupTags.length > 1) {
                                                //             singleAndGroupedTags.push(temporaryTagsArray.groupTags);
                                                //         } else {
                                                //             isolatedTags.push(currentTag);
                                                //         }
                                                //     }
                                                // }

                                                //getting the tag clouds
                                                // tagClouds = singleAndGroupedTags.filter(x => x.length > 1);
                                                // console.log(tagClouds)
                                                // console.log(cloudAndSinle)
                                                console.log(cloudAndSinle)


                                                canvasService.loadTagCloudsImages(cloudAndSinle.clouds, (images) => {
                                                    if (canvasCtrl.isAdmin === 1 || canvasCtrl.isTracker === 1) {
                                                        // drawing the clouds on the canvas
                                                        images.forEach(function (image, index) {
                                                            if (image !== null) {
                                                                drawCloudIcon(tagClouds[0][0], bufferContext, images[0], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[0].length);
                                                            }
                                                        });
                                                    } else if (canvasCtrl.isUserManager && dataService.switch.showOutdoorTags) {
                                                        if (dataService.checkIfTagsHaveAlarms(tagsByFloorAndLocation.result)) {
                                                            images.forEach(function (image, index) {
                                                                if (image !== null) {
                                                                    drawCloudIcon(tagClouds[index][0], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[0].length);
                                                                }
                                                            });
                                                        }
                                                    }
                                                    // else {
                                                    //     if (dataService.checkIfTagsHaveAlarms(tagsByFloorAndLocation.result)) {
                                                    //         images.forEach(function (image, index) {
                                                    //             if (image !== null) {
                                                    //                 drawCloudIcon(tagClouds[index][0], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[0].length);
                                                    //             }
                                                    //         });
                                                    //     }
                                                    // }
                                                });

                                                canvasService.loadTagSingleImages(cloudAndSinle.single, (images) => {

                                                })
                                                // if (canvasCtrl.isAdmin|| canvasCtrl.isTracker) {
                                                //
                                                //
                                                //     // console.log(imgs)
                                                //     dataService.loadImagesAsynchronouslyWithPromise(tagClouds, 'tag')
                                                //         .then((images) => {
                                                //             //control if there are clouds to bhe shown
                                                //             // // console.log(images)
                                                //             // if (images !== null) {
                                                //             //     if (images[0] !== null) {
                                                //             //         if (canvasCtrl.isAdmin === 1 || canvasCtrl.isTracker === 1) {
                                                //             //             // drawing the clouds on the canvas
                                                //             //             images.forEach(function (image, index) {
                                                //             //                 if (image !== null) {
                                                //             //                     drawCloudIcon(tagClouds[0][0], bufferContext, images[0], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[0].length);
                                                //             //                 }
                                                //             //             });
                                                //             //         } else if (dataService.switch.showOutdoorTags) {
                                                //             //             if (dataService.checkIfTagsHaveAlarms(tagsByFloorAndLocation.result)) {
                                                //             //                 images.forEach(function (image, index) {
                                                //             //                     if (image !== null) {
                                                //             //                         drawCloudIcon(tagClouds[index][0], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[0].length);
                                                //             //                     }
                                                //             //                 });
                                                //             //             }
                                                //             //         } else {
                                                //             //             if (dataService.checkIfTagsHaveAlarms(tagsByFloorAndLocation.result)) {
                                                //             //                 images.forEach(function (image, index) {
                                                //             //                     if (image !== null) {
                                                //             //                         drawCloudIcon(tagClouds[index][0], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[0].length);
                                                //             //                     }
                                                //             //                 });
                                                //             //             }
                                                //             //         }
                                                //             //     }
                                                //             // }
                                                //
                                                //             return dataService.loadImagesAsynchronouslyWithPromise(isolatedTags, 'tag');
                                                //         })
                                                //         .then((images) => {
                                                //             if (images !== null) {
                                                //                 //drawing the isolated tags
                                                //                 isolatedTags.forEach(function (tag, index) {
                                                //                     if (!dataService.isOutdoor(tag)) {
                                                //                         if (canvasCtrl.isAdmin === 1 || canvasCtrl.isTracker === 1) {
                                                //                             // if(dataService.checkIfTagHasAlarm(tag) || !tag.radio_switched_off) {
                                                //                             //     drawIcon(tag, bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                             // }
                                                //                             if (dataService.checkIfTagHasAlarm(tag) && !tag.radio_switched_off) {
                                                //                                 dataService.loadAlarmsImagesWithPromise(dataService.getTagAlarms(tag))
                                                //                                     .then((alarmImages) => {
                                                //                                         if (alarmsCounts[index] > alarmImages.length - 1)
                                                //                                             alarmsCounts[index] = 0;
                                                //                                         drawIcon(tag, bufferContext, alarmImages[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                                         context.drawImage(bufferCanvas, 0, 0);
                                                //                                         contextDrawed = true;
                                                //                                     });
                                                //                             } else if (dataService.isTagOffline(tag)) {
                                                //                                 drawIcon(tag, bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                             } else if (!tag.radio_switched_off) {
                                                //                                 drawIcon(tag, bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                             } else {
                                                //                                 if (dataService.checkIfTagHasAlarm(tag) && !tag.radio_switched_off) {
                                                //                                     dataService.loadAlarmsImagesWithPromise(dataService.getTagAlarms(tag))
                                                //                                         .then((alarmImages) => {
                                                //                                             if (alarmsCounts[index] > alarmImages.length - 1)
                                                //                                                 alarmsCounts[index] = 0;
                                                //
                                                //                                             drawIcon(tag, bufferContext, alarmImages[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                                             context.drawImage(bufferCanvas, 0, 0);
                                                //                                             contextDrawed = true;
                                                //                                         })
                                                //                                 } else if (tag.radio_switched_off !== 1 && (new Date(Date.now()) - (new Date(tag.time)) < tag.sleep_time_indoor)) {
                                                //                                     drawIcon(tag, bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                                 } else if (tag.radio_switched_off !== 1 && (new Date(Date.now()) - (new Date(tag.time)) > tag.sleep_time_indoor)) {
                                                //                                     drawIcon(tag, bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                                 }
                                                //                             }
                                                //                         } else if (canvasCtrl.isUserManager && dataService.switch.showOutdoorTags) {
                                                //                             if (dataService.checkIfTagsHaveAlarms(tagsByFloorAndLocation.result)) {
                                                //
                                                //                                 // if (tag.tag_type_id === 1 || tag.tag_type_id === 14 || tag.tag_type_id === 5 || tag.tag_type_id === 9 || tag.tag_type_id === 17 || tag.tag_type_id === 19) {
                                                //                                 //     if (dataService.checkIfTagHasAlarm(tag)) {
                                                //                                 //         dataService.loadAlarmsImagesWithPromise(dataService.getTagAlarms(tag))
                                                //                                 //             .then((alarmImages) => {
                                                //                                 //                 if (alarmsCounts[index] > alarmImages.length - 1)
                                                //                                 //                     alarmsCounts[index] = 0;
                                                //                                 //                 drawIcon(tag, bufferContext, alarmImages[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                                 //                 context.drawImage(bufferCanvas, 0, 0);
                                                //                                 //                 contextDrawed = true;
                                                //                                 //             });
                                                //                                 //     } else if (!dataService.isTagOffline(tag)) {
                                                //                                 //         drawIcon(tag, bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                                 //     }
                                                //                                 // } else {
                                                //                                 if (dataService.checkIfTagHasAlarm(tag)) {
                                                //                                     dataService.loadAlarmsImagesWithPromise(dataService.getTagAlarms(tag))
                                                //                                         .then((alarmImages) => {
                                                //                                             if (alarmsCounts[index] > alarmImages.length - 1)
                                                //                                                 alarmsCounts[index] = 0;
                                                //
                                                //                                             drawIcon(tag, bufferContext, alarmImages[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                                             context.drawImage(bufferCanvas, 0, 0);
                                                //                                             contextDrawed = true;
                                                //                                         })
                                                //                                 } else if (tag.radio_switched_off !== 1 && (new Date(Date.now()) - (new Date(tag.time)) < tag.sleep_time_indoor)) {
                                                //                                     drawIcon(tag, bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                                 }
                                                //                                 // } else if (tag.radio_switched_off !== 1 && (new Date(Date.now()) - (new Date(tag.time)) > tag.sleep_time_indoor)) {
                                                //                                 //     drawIcon(tag, bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                                 // }
                                                //                                 // }
                                                //                             }
                                                //                         } else {
                                                //                             if (dataService.checkIfTagsHaveAlarms(tagsByFloorAndLocation.result)) {
                                                //                                 if (dataService.checkIfTagHasAlarm(tag)) {
                                                //                                     dataService.loadAlarmsImagesWithPromise(dataService.getTagAlarms(tag))
                                                //                                         .then((alarmImages) => {
                                                //                                             if (alarmsCounts[index] > alarmImages.length - 1)
                                                //                                                 alarmsCounts[index] = 0;
                                                //                                             drawIcon(tag, bufferContext, alarmImages[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                                             context.drawImage(bufferCanvas, 0, 0);
                                                //                                             contextDrawed = true;
                                                //                                         });
                                                //                                 }
                                                //                             }
                                                //                         }
                                                //                     }
                                                //                 })
                                                //             }
                                                //             if (!contextDrawed) {
                                                //                 context.drawImage(bufferCanvas, 0, 0);
                                                //                 contextDrawed = false;
                                                //             }
                                                //         });
                                                // } else {
                                                //     dataService.loadImagesAsynchronouslyWithPromise(tagClouds, 'tag')
                                                //         .then((images) => {
                                                //             //control if there are clouds to bhe shown
                                                //             if (images[0] !== null) {
                                                //
                                                //                 tagClouds.forEach(tags => {
                                                //                     if (dataService.checkIfTagsHaveAlarms(tags)) {
                                                //                         images.forEach(function (image, index) {
                                                //                             if (image !== null) {
                                                //                                 drawCloudIcon(tagClouds[index][0], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, tagClouds[0].length);
                                                //                                 context.drawImage(bufferCanvas, 0, 0);
                                                //                                 contextDrawed = true;
                                                //                             }
                                                //                         });
                                                //                     }
                                                //                 })
                                                //             }
                                                //
                                                //             return dataService.loadImagesAsynchronouslyWithPromise(isolatedTags, 'tag');
                                                //         })
                                                //         .then((images) => {
                                                //             if (images[0] !== null) {
                                                //                 //drawing the isolated tags
                                                //                 isolatedTags.forEach(function (tag, index) {
                                                //                     if (!dataService.isOutdoor(tag)) {
                                                //                         if (dataService.checkIfTagHasAlarm(tag)) {
                                                //                             dataService.loadAlarmsImagesWithPromise(dataService.getTagAlarms(tag))
                                                //                                 .then((alarmImages) => {
                                                //                                     if (alarmsCounts[index] > alarmImages.length - 1)
                                                //                                         alarmsCounts[index] = 0;
                                                //
                                                //                                     drawIcon(tag, bufferContext, alarmImages[alarmsCounts[index]++], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                                     context.drawImage(bufferCanvas, 0, 0);
                                                //                                     contextDrawed = true;
                                                //                                 });
                                                //
                                                //                         }
                                                //                         // drawIcon(tag, bufferContext, images[index], canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, true);
                                                //                         // context.drawImage(bufferCanvas, 0, 0);
                                                //
                                                //                     }
                                                //                 })
                                                //             }
                                                //         });
                                                //     if (!contextDrawed) {
                                                //         context.drawImage(bufferCanvas, 0, 0);
                                                //         contextDrawed = false;
                                                //     }
                                                // }
                                            });
                                        });

                                    });
                                });
                            });

                        });
                    });
                });


                // TODO - see where to put this
                // context.drawImage(bufferCanvas, 0, 0);

                newSocketService.getData('get_all_tags', {}, (response) => {
                    if (!response.session_state)
                        window.location.reload();

                    dataService.allTags = response.result;

                    dataService.checkIfTagsAreOutOfLocations(response.result).then(result => {
                        if (dataService.switch.showOutrangeTags && result.some(r => r === true))
                            canvasCtrl.showAlarmsIcon = true;
                    });

                    canvasCtrl.showAlarmsIcon = dataService.checkIfTagsHaveAlarms(response.result);

                    //showing the offline tags alarm icon
                    canvasCtrl.showOfflineTagsIcon = dataService.checkIfTagsAreOffline(response.result);
                });

                newSocketService.getData('get_engine_on', {}, (response) => {
                    if (!response.session_state)
                        window.location.reload();

                    canvasCtrl.showEngineOffIcon = response.result === 0;
                });
            }, 1000);
        };

        $rootScope.$on('constantUpdateCanvas', function () {
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
            let tempDrawZones = [];

            drawedZones.forEach((zone) => {
                let topLeft       = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.topLeft.x, zone.topLeft.y);
                let bottomRight   = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.bottomRight.x, zone.bottomRight.y);
                let zonesModified = canvasCtrl.floorData.floorZones.some(z => zone.id === z.id);

                if (!zonesModified)
                    tempDrawZones.push({topLeft: topLeft, bottomRight: bottomRight, floor: zone.floor});
            });

            newSocketService.getData('save_drawing', {
                lines: JSON.stringify(drawedLines),
                floor: canvasCtrl.defaultFloor[0].id,
                zones: tempDrawZones
            }, (response) => {
                if (!response.session_state)
                    window.location.reload();

                if (response.result.length > 0) {
                    $mdDialog.show({
                        templateUrl        : componentsPath + 'tag-not-found-alert.html',
                        parent             : angular.element(document.body),
                        targetEvent        : event,
                        clickOutsideToClose: true,
                        controller         : ['$scope', '$controller', ($scope, $controller) => {
                            $controller('languageController', {$scope: $scope});


                            $scope.title   = lang.drawingNotSaved.toUpperCase();
                            $scope.message = lang.unableToSaveData;

                            $scope.hide = () => {
                                $mdDialog.hide();
                            }
                        }]
                    })
                } else {

                    let scaledAnchorPosition = [];
                    let drawAnchor           = [];

                    //TODO update anchors only if there is at least one anchor modified
                    dataService.anchorsToUpdate.forEach((anchor) => {
                        let scaledSize = {width: anchor.x_pos, height: anchor.y_pos};
                        scaledAnchorPosition.push(scaledSize);
                        drawAnchor.push(anchor.id);
                    });

                    newSocketService.getData('update_anchor_position', {
                        position: scaledAnchorPosition,
                        id      : drawAnchor,
                        floor   : canvasCtrl.floorData.defaultFloorName
                    }, (updatedAnchors) => {
                        if (updatedAnchors.result.length === 0) {
                            $mdDialog.show({
                                templateUrl        : componentsPath + 'operation-successfull.html',
                                parent             : angular.element(document.body),
                                targetEvent        : event,
                                clickOutsideToClose: true,
                                controller         : ['$scope', '$controller', ($scope, $controller) => {
                                    $controller('languageController', {$scope: $scope});


                                    $scope.title   = lang.drawingSaved.toUpperCase();
                                    $scope.message = lang.dataSavedSuccessfully;

                                    $scope.hide = () => {
                                        $mdDialog.hide();
                                    }
                                }]
                            });

                            $timeout(function () {
                                $mdDialog.hide();
                                dataService.switch.showAnchors = true;
                                dataService.switch.showCameras = true;
                                canvasCtrl.switch.showDrawing  = false;

                                dropAnchorPosition                 = null;
                                drawAnchorImage                    = null;
                                canvasCtrl.speedDial.clickedButton = '';

                                dataService.anchorsToUpdate = [];
                                if (dataService.canvasInterval === undefined) constantUpdateCanvas();
                            }, 1500);
                        } else {
                            $mdDialog.show({
                                templateUrl        : componentsPath + 'tag-not-found-alert.html',
                                parent             : angular.element(document.body),
                                targetEvent        : event,
                                clickOutsideToClose: true,
                                controller         : ['$scope', '$controller', ($scope, $controller) => {
                                    $controller('languageController', {$scope: $scope});


                                    $scope.title   = lang.dataSaved.toUpperCase();
                                    $scope.message = lang.unableToSaveData;

                                    $scope.hide = () => {
                                        $mdDialog.hide();
                                    }
                                }]
                            })
                        }
                    });
                }
            });
        };

        canvasCtrl.cancelDrawing = () => {
            $mdDialog.show({
                templateUrl        : componentsPath + 'tag-not-found-alert.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', '$controller', ($scope, $controller) => {
                    $controller('languageController', {$scope: $scope});


                    $scope.title   = lang.actionCanceled.toUpperCase();
                    $scope.message = lang.actionCanceled;

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            });

            $timeout(function () {
                $mdDialog.hide();

                dataService.switch.showAnchors = true;
                dataService.switch.showCameras = true;
                canvasCtrl.switch.showDrawing  = false;

                dropAnchorPosition                 = null;
                drawAnchorImage                    = null;
                canvasCtrl.speedDial.clickedButton = '';
                if (dataService.canvasInterval === undefined) constantUpdateCanvas();
            }, 2000);
        };

        //handeling the canvas click
        canvas.addEventListener('mousemove', (event) => {
            if (dataService.switch !== undefined && canvasCtrl.switch.showDrawing) {

                //drawing the lines on the canvas
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

                //drawing the actual zone on the canvas
                if (dragingStarted === 1 && canvasCtrl.speedDial.clickedButton === 'draw_zone') {
                    drawZoneRectFromDrawing({
                        x : prevClick.x,
                        y : prevClick.y,
                        xx: canvas.canvasMouseClickCoords(event).x,
                        yy: canvas.canvasMouseClickCoords(event).y
                    }, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, 'red', alpha);
                }

                //redrawing the old zones on the canvas
                if (zones !== null && canvasCtrl.speedDial.clickedButton !== 'drop_anchor') {
                    zones.forEach((zone) => {
                        drawZoneRect({
                            x : zone.x_left,
                            y : zone.y_up,
                            xx: zone.x_right,
                            yy: zone.y_down
                        }, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.color, true, alpha);
                    })
                }

                if (drawedZones !== null && canvasCtrl.speedDial.clickedButton !== 'drop_anchor') {
                    drawedZones.forEach((zone) => {
                        drawZoneRectFromDrawing({
                            x : zone.topLeft.x,
                            y : zone.topLeft.y,
                            xx: zone.bottomRight.x,
                            yy: zone.bottomRight.y
                        }, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, 'red', alpha);
                    })
                }

                if (zoneToModify !== null) {
                    drawedZones = drawedZones.filter(z => !angular.equals(zoneToModify, z));
                    zones       = zones.filter(z => z.id !== zoneToModify.id);
                    drawZoneRectFromDrawing({
                        x : zoneToModify.bottomRight.x,
                        y : zoneToModify.bottomRight.y,
                        xx: canvas.canvasMouseClickCoords(event).x,
                        yy: canvas.canvasMouseClickCoords(event).y
                    }, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, 'red', alpha);
                }
            }
        });

        //handeling the mouse move on the canvas
        canvas.addEventListener('mousedown', function (event) {
            let tagCloud    = null;
            let dialogShown = false;
            let realHeight  = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;

            mouseDownCoords = canvas.canvasMouseClickCoords(event);

            //drawing lines on canvas
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

            //changing the anchor position
            if (canvasCtrl.speedDial.clickedButton === 'drop_anchor') {
                $mdDialog.show({
                    templateUrl        : componentsPath + 'select_drop_anchor.html',
                    parent             : angular.element(document.body),
                    targetEvent        : event,
                    clickOutsideToClose: true,
                    controller         : ['$scope', 'dataService', ($scope, dataService) => {
                        $scope.dropAnchor = {
                            selectedAnchor: ''
                        };

                        newSocketService.getData('get_anchors_by_location', {location: dataService.location.name}, (response) => {
                            if (!response.session_state)
                                window.location.reload();

                            $scope.anchors              = response.result;
                            dataService.locationAnchors = response.result;
                            $scope.$apply();
                        });

                        $scope.$watch('dropAnchor.selectedAnchor', (newValue) => {
                            let currentValue = "" + newValue;
                            if (currentValue !== '') {
                                anchorToDrop = currentValue;
                                $mdDialog.hide();
                                for (let index in dataService.locationAnchors) {
                                    if (dataService.locationAnchors[index].name === newValue) {
                                        let scaledSize                              = scaleSizeFromVirtualToReal(canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, mouseDownCoords.x, mouseDownCoords.y);
                                        dataService.locationAnchors[index].x_pos    = parseFloat(scaledSize.x);
                                        dataService.locationAnchors[index].y_pos    = parseFloat(scaledSize.y);
                                        dataService.locationAnchors[index].floor_id = canvasCtrl.defaultFloor[0].id;
                                        dataService.anchorsToUpdate.push(dataService.locationAnchors[index]);
                                        if (dataService.anchors.some(a => a.id === dataService.locationAnchors[index].id)) {
                                            for (let anchorIndex in dataService.anchors) {
                                                if (dataService.anchors[anchorIndex].id === dataService.locationAnchors[index].id) {
                                                    dataService.anchors[anchorIndex].x_pos    = parseFloat(scaledSize.x);
                                                    dataService.anchors[anchorIndex].y_pos    = parseFloat(scaledSize.y);
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

            //deleting drawed lines
            if (canvasCtrl.speedDial.clickedButton === 'delete') {
                let toBeRemoved = drawedLines.filter(l => ((l.begin.x - 5 <= mouseDownCoords.x && mouseDownCoords.x <= l.begin.x + 5) && (l.begin.y - 5 <= mouseDownCoords.y && mouseDownCoords.y <= l.begin.y + 5))
                    || ((l.end.x - 5 <= mouseDownCoords.x && mouseDownCoords.x <= l.end.x + 5) && (l.end.y - 5 <= mouseDownCoords.y && mouseDownCoords.y <= l.end.y + 5)));


                if (toBeRemoved.length > 0) {
                    drawedLines = drawedLines.filter(l => !toBeRemoved.some(r => r.begin.x === l.begin.x && r.begin.y === l.begin.y
                        && r.end.x === l.end.x && r.end.y === l.end.y));

                    updateDrawingCanvas([], drawedLines, canvas.width, canvas.height, context, canvasImage, canvasCtrl.defaultFloor[0].map_spacing, canvasCtrl.defaultFloor[0].width, canvasCtrl.switch.showDrawing, (canvasCtrl.speedDial.clickedButton === 'drop_anchor'));

                    if (zones !== null && canvasCtrl.speedDial.clickedButton !== 'drop_anchor') {
                        zones.forEach((zone) => {
                            drawZoneRect({
                                x : zone.x_left,
                                y : zone.y_up,
                                xx: zone.x_right,
                                yy: zone.y_down
                            }, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.color, true, alpha);
                        })
                    }

                    if (drawedZones !== null && canvasCtrl.speedDial.clickedButton !== 'drop_anchor') {
                        drawedZones.forEach((zone) => {
                            drawZoneRectFromDrawing({
                                x : zone.topLeft.x,
                                y : zone.topLeft.y,
                                xx: zone.bottomRight.x,
                                yy: zone.bottomRight.y
                            }, context, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height, zone.color, alpha);
                        })
                    }
                }
            }

            //drawing zones
            if (canvasCtrl.speedDial.clickedButton === 'draw_zone') {
                dragingStarted++;
                if (dragingStarted === 1) {
                    prevClick = canvas.canvasMouseClickCoords(event);
                } else if (dragingStarted === 2) {
                    let topLeft     = null;
                    let bottomRight = null;
                    //up left
                    if (prevClick.x < mouseDownCoords.x && prevClick.y < mouseDownCoords.y) {
                        drawedZones.push({
                            topLeft    : prevClick,
                            bottomRight: mouseDownCoords,
                            floor      : canvasCtrl.defaultFloor[0].id
                        });
                    }//up right
                    else if (prevClick.x > mouseDownCoords.x && prevClick.y < mouseDownCoords.y) {
                        topLeft     = {x: mouseDownCoords.x, y: prevClick.y};
                        bottomRight = {x: prevClick.x, y: mouseDownCoords.y};
                        drawedZones.push({
                            topLeft    : topLeft,
                            bottomRight: bottomRight,
                            floor      : canvasCtrl.defaultFloor[0].id
                        });
                    }//down left
                    else if (prevClick.x < mouseDownCoords.x && prevClick.y > mouseDownCoords.y) {
                        topLeft     = {x: prevClick.x, y: mouseDownCoords.y};
                        bottomRight = {x: mouseDownCoords.x, y: prevClick.y};
                        drawedZones.push({
                            topLeft    : topLeft,
                            bottomRight: bottomRight,
                            floor      : canvasCtrl.defaultFloor[0].id
                        });
                    }//down right
                    else if (prevClick.x > mouseDownCoords.x && prevClick.y > mouseDownCoords.y) {
                        drawedZones.push({
                            topLeft    : mouseDownCoords,
                            bottomRight: prevClick,
                            floor      : canvasCtrl.defaultFloor[0].id
                        });
                    } else {
                        console.log('no case finded');
                    }
                    dragingStarted = 0;
                }
            }

            //modifying a zone
            if (canvasCtrl.speedDial.clickedButton === 'modify_zone') {
                dragingStarted++;
                drawedZones.forEach((zone) => {
                    if (dragingStarted === 1) {
                        prevClick = canvas.canvasMouseClickCoords(event);
                        if (prevClick.x >= zone.topLeft.x - 5 && prevClick.x <= zone.topLeft.x + 10 && prevClick.y >= zone.topLeft.y - 5 && prevClick.y <= zone.topLeft.y + 10) {
                            zoneToModify = zone;
                        }
                    }
                });

                zones.forEach((zone) => {
                    if (dragingStarted === 1) {
                        prevClick      = canvas.canvasMouseClickCoords(event);
                        let realHeight = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;

                        let virtualPositionTop    = scaleIconSize(zone.x_left, zone.y_up, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                        let virtualPositionBottom = scaleIconSize(zone.x_right, zone.y_down, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);

                        if (prevClick.x >= virtualPositionTop.width - (5 | 0) && prevClick.x <= virtualPositionTop.width + (10 | 0) && prevClick.y >= virtualPositionTop.height - (5 | 0) && prevClick.y <= virtualPositionTop.height + (10 | 0)) {
                            zoneToModify = {
                                id         : zone.id,
                                topLeft    : {x: virtualPositionTop.width, y: virtualPositionTop.height},
                                bottomRight: {x: virtualPositionBottom.width, y: virtualPositionBottom.height},
                                floor      : canvasCtrl.defaultFloor[0].id
                            };
                        }
                    }
                });

                if (dragingStarted === 2) {
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

                            newSocketService.getData('update_floor_zone', {
                                zone_id: zoneToModify.id,
                                x_left : topLeftScaled.x,
                                x_right: bottomDownScalled.x,
                                y_up   : topLeftScaled.y,
                                y_down : bottomDownScalled.y
                            }, (response) => {
                                if (!response.session_state)
                                    window.location.reload();
                            });
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
                    zoneToModify   = null;
                    dragingStarted = 0;
                }
            }

            //deleting an existing zone
            if (canvasCtrl.speedDial.clickedButton === 'delete_zone') {
                let findedZones       = findZone(mouseDownCoords, zones, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height);
                let findedDrawedZones = findDrawedZone(mouseDownCoords, drawedZones, canvasCtrl.defaultFloor[0].width, canvas.width, canvas.height);
                if (findedDrawedZones.length !== 0) {
                    drawedZones = drawedZones.filter(z => !findedDrawedZones.some(fz => angular.equals(z, fz)));
                }

                if (findedZones.length !== 0) {
                    newSocketService.getData('delete_floor_zones', {zones: findedZones}, (response) => {
                        if (response.result.session_state)
                            window.location.reload();

                        zones = zones.filter(z => !findedZones.some(fz => fz === z.id));
                    });
                }
            }

            //managing the click on the tag icons
            dataService.floorTags.forEach(function (tag) {
                let virtualTagPosition = scaleIconSize(tag.x_pos, tag.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                tagCloud               = dataService.groupNearTags(dataService.floorTags, tag);

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
                                        $scope.isTagInAlarm = (dataService.checkIfTagsHaveAlarms(tags)) ? 'background-red' : 'background-green';
                                        let tempAlarmTag    = [];

                                        $scope.tags.forEach(function (tagElem) {
                                            if (canvasCtrl.isAdmin || canvasCtrl.isTracker) {
                                                let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tagElem);
                                                tagAlarms.forEach(function (ta) {
                                                    tempAlarmTag.push(ta);
                                                })
                                            } else if (canvasCtrl.isUserManager && dataService.switch.showOutdoorTags) {
                                                let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tagElem);
                                                tagAlarms.forEach(function (ta) {
                                                    tempAlarmTag.push(ta);
                                                })
                                            } else if (canvasCtrl.isUserManager && !dataService.switch.showOutdoorTags) {
                                                if (dataService.checkIfTagHasAlarm(tagElem)) {
                                                    let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tagElem, null, '');
                                                    tagAlarms.forEach(function (ta) {
                                                        tempAlarmTag.push(ta);
                                                    })
                                                }
                                                $scope.tags = $scope.tags.filter(t => dataService.checkIfTagHasAlarm(t));
                                            } else {
                                                if (dataService.checkIfTagHasAlarm(tagElem)) {
                                                    let tagAlarms = dataService.loadTagAlarmsForInfoWindow(tagElem);
                                                    tagAlarms.forEach(function (ta) {
                                                        tempAlarmTag.push(ta);
                                                    })
                                                }
                                                $scope.tags = $scope.tags.filter(t => dataService.checkIfTagHasAlarm(t));
                                            }
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
                            // if (tag.tag_type_id === 1 || tag.tag_type_id === 14 || tag.tag_type_id === 5 || tag.tag_type_id === 9 || tag.tag_type_id === 17 || tag.tag_type_id === 19) {
                            //     if (dataService.checkIfTagHasAlarm(tag)){
                            //         $mdDialog.show({
                            //             locals             : {tag: tag},
                            //             templateUrl        : componentsPath + 'tag-info.html',
                            //             parent             : angular.element(document.body),
                            //             targetEvent        : event,
                            //             clickOutsideToClose: true,
                            //             controller         : ['$scope', 'tag', function ($scope, tag) {
                            //                 $scope.tag          = tag;
                            //                 $scope.isTagInAlarm = (dataService.checkIfTagsHaveAlarms(tags)) ? 'background-red' : 'background-green';
                            //                 $scope.alarms       = dataService.loadTagAlarmsForInfoWindow(tag);
                            //
                            //                 $scope.hide = () => {
                            //                     $mdDialog.hide();
                            //                 }
                            //             }]
                            //         })
                            //     } else if (!dataService.isTagOffline(tag)) {
                            //         $mdDialog.show({
                            //             locals             : {tag: tag},
                            //             templateUrl        : componentsPath + 'tag-info.html',
                            //             parent             : angular.element(document.body),
                            //             targetEvent        : event,
                            //             clickOutsideToClose: true,
                            //             controller         : ['$scope', 'tag', function ($scope, tag) {
                            //                 $scope.tag          = tag;
                            //                 $scope.isTagInAlarm = 'background-red';
                            //                 $scope.alarms       = dataService.loadTagAlarmsForInfoWindow(tag);
                            //
                            //                 if ($scope.alarms.length === 0) {
                            //                     ($scope.tag.is_exit && !$scope.tag.radio_switched_off)
                            //                         ? $scope.isTagInAlarm = 'background-gray'
                            //                         : $scope.isTagInAlarm = 'background-green';
                            //                 }
                            //
                            //                 $scope.hide = () => {
                            //                     $mdDialog.hide();
                            //                 }
                            //             }]
                            //         })
                            //     }
                            // } else if (dataService.checkIfTagHasAlarm(tag) || tag.radio_switched_off !== 1) {
                            //     $mdDialog.show({
                            //         locals             : {tag: tag},
                            //         templateUrl        : componentsPath + 'tag-info.html',
                            //         parent             : angular.element(document.body),
                            //         targetEvent        : event,
                            //         clickOutsideToClose: true,
                            //         controller         : ['$scope', 'tag', function ($scope, tag) {
                            //             $scope.tag          = tag;
                            //             $scope.isTagInAlarm = 'background-red';
                            //             $scope.alarms       = dataService.loadTagAlarmsForInfoWindow(tag);
                            //
                            //             if ($scope.alarms.length !== 0){
                            //                 $scope.isTagInAlarm = 'background-red'
                            //             } else if (new Date(Date.now()) - (new Date(tag.time)) < tag.sleep_time_indoor){
                            //                 $scope.isTagInAlarm = 'background-green'
                            //             } else {
                            //                 $scope.isTagInAlarm = 'background-gray'
                            //             }
                            //
                            //             $scope.hide = () => {
                            //                 $mdDialog.hide();
                            //             }
                            //         }]
                            //     })
                            // }
                        }
                    }
                }
            });

            //managing the click on the anchor icons
            dataService.anchors.forEach(function (anchor) {
                if (!isTagAtCoords(mouseDownCoords, 45) && !canvasCtrl.switch.showDrawing) {
                    let virtualAnchorPosition = scaleIconSize(anchor.x_pos, anchor.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                    if (dataService.isElementAtClick(virtualAnchorPosition, mouseDownCoords, 45)) {

                        $mdDialog.show({
                            locals             : {anchor: anchor},
                            templateUrl        : componentsPath + 'anchor-info.html',
                            parent             : angular.element(document.body),
                            targetEvent        : event,
                            clickOutsideToClose: true,
                            controller         : ['$scope', 'anchor', function ($scope, anchor) {
                                $scope.anchor         = anchor;
                                $scope.isAnchorOnline = 'background-green';

                                if (anchor.is_offline) {
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
                if (!isTagAtCoords(mouseDownCoords, 45) && !canvasCtrl.switch.showDrawing) {
                    let virtualCamerasPosition = scaleIconSize(camera.x_pos, camera.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                    if (dataService.isElementAtClick(virtualCamerasPosition, mouseDownCoords, 45)) {
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
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);

            let locationSelected = false;

            $mdDialog.show({
                templateUrl        : componentsPath + 'indoor-alarms-info.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', 'dataService', function ($scope, dataService) {
                    $scope.alarms          = [];
                    $scope.outlocationTags = dataService.switch.showOutrangeTags;
                    let locations          = [];
                    let indoorLocationTags = [];
                    let allTags            = [];

                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order       : 'name',
                        limit       : 5,
                        page        : 1
                    };

                    dataService.alarmsInterval = $interval(() => {
                        console.log('alarm timer');
                        newSocketService.getData('get_all_tags', {}, (allTagsResult) => {
                            allTags = allTagsResult.result;
                            newSocketService.getData('get_tags_by_user', {user: dataService.user.username}, (userTags) => {
                                if (!userTags.session_state)
                                    window.location.reload();

                                newSocketService.getData('get_user_locations', {user: dataService.user.id}, (userLocations) => {
                                    if (!userLocations.session_state)
                                        window.location.reload();

                                    newSocketService.getData('get_all_locations', {}, (response) => {
                                        if (!response.session_state)
                                            window.location.reload();

                                        locations = response.result;

                                        indoorLocationTags        = userTags.result;
                                        let indoorNoLocationTags  = allTags.filter(t => !dataService.isOutdoor(t) && t.anchor_id === null);
                                        let outdoorLocationTags   = allTags.filter(t => dataService.isOutdoor(t) && t.gps_north_degree !== -2 && t.gps_east_degree !== -2);
                                        let outdoorNoSiteTags     = allTags.filter(t => (dataService.isOutdoor(t) && t.gps_north_degree === -2 && t.gps_east_degree === -2));
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

                                                if (tagAlarms.length === 0) {
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

                                            if (tagAlarms.length === 0) {
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

                                                if (tagAlarms.length === 0) {
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

                                            $scope.alarms = $scope.alarms.filter(a => !localTagAlarms.some(lta => lta.tagId === a.tagId && lta.name === a.name))

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
                        let tag = tags.filter(t => t.id === alarm.tagId)[0];

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
                                    let outdoorLocationOld = dataService.location;
                                    newSocketService.getData('save_location', {location: tagLocation[0].name}, (response) => {
                                        if (!response.session_state)
                                            window.location.reload();

                                        if (response.result === 'location_saved' && outdoorLocationOld.is_inside) {
                                            locationSelected = true;
                                            $state.go('outdoor-location');
                                        } else {
                                            window.location.reload();
                                        }
                                    });
                                } //if the tag is out of all the locations the I show the message tag out of locations
                                else if (alarm.name === 'Tag fuori sito') {
                                    $mdDialog.show({
                                        locals             : {tagName: alarm, outerScope: $scope},
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

                                            let tag = tags.filter(t => t.name === tagName.tag)[0];

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
                                console.log(dataService.locationFromClick);
                                if (dataService.location.name === indoorTag.location_name) {
                                    if (indoorTag.floor_name !== canvasCtrl.floorData.defaultFloorName) {
                                        newSocketService.getData('get_floors_by_location', {location: indoorTag.location_name}, (response) => {
                                            if (!response.session_state) {
                                                window.location.reload();
                                            }

                                            $mdDialog.hide();
                                            locationSelected = true;

                                            let selectedFloor                     = response.result.filter(f => f.name === indoorTag.floor_name)[0];
                                            canvasCtrl.floorData.defaultFloorName = selectedFloor.name;
                                            dataService.defaultFloorName          = selectedFloor.name;
                                            canvasCtrl.floorData.gridSpacing      = selectedFloor.map_spacing;
                                            canvasCtrl.floorData.floor_image_map  = selectedFloor.image_map;
                                            canvasImage.src                       = floorPath + selectedFloor.image_map;
                                            context.clearRect(0, 0, canvas.width, canvas.height);
                                        })
                                    } else {
                                        $mdDialog.hide();
                                    }
                                } else {
                                    console.log('saving location');
                                    newSocketService.getData('save_location', {location: indoorTag.location_name}, (response) => {
                                        if (!response.session_state)
                                            window.location.reload();

                                        if (response.result === 'location_saved') {
                                            newSocketService.getData('get_location_info', {}, (response) => {
                                                dataService.location = response.result;
                                                newSocketService.getData('get_floors_by_location', {location: indoorTag.location_name}, (response) => {
                                                    if (!response.session_state) {
                                                        window.location.reload();
                                                    }

                                                    $mdDialog.hide();
                                                    locationSelected = true;

                                                    let selectedFloor                     = response.result.filter(f => f.name === indoorTag.floor_name)[0];
                                                    canvasCtrl.floorData.defaultFloorName = selectedFloor.name;
                                                    canvasCtrl.floorData.location         = dataService.location.name;
                                                    dataService.defaultFloorName          = selectedFloor.name;
                                                    canvasCtrl.floorData.gridSpacing      = selectedFloor.map_spacing;
                                                    canvasCtrl.floorData.floor_image_map  = selectedFloor.image_map;
                                                    canvasImage.src                       = floorPath + selectedFloor.image_map;
                                                    context.clearRect(0, 0, canvas.width, canvas.height);
                                                    locationSelected = true;
                                                });
                                            });
                                        }
                                    });

                                }

                            }
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving         : function () {
                    //if there is no location selected from alarm window then I rund the interval
                    dataService.alarmsInterval = dataService.stopTimer(dataService.alarmsInterval);
                    if (dataService.canvasInterval === undefined && !locationSelected)
                        constantUpdateCanvas();
                }
            })
        };

        //function that control if the there is a tag at the coordinates passed as parameter
        let isTagAtCoords = (coords, distance) => {
            return dataService.floorTags.some(function (tag) {
                let realHeight         = (canvasCtrl.defaultFloor[0].width * canvas.height) / canvas.width;
                let virtualTagPosition = scaleIconSize(tag.x_pos, tag.y_pos, canvasCtrl.defaultFloor[0].width, realHeight, canvas.width, canvas.height);
                return !dataService.isOutdoor(tag) && (((virtualTagPosition.width - distance) < coords.x && coords.x < (virtualTagPosition.width + distance)) && ((virtualTagPosition.height - distance) < coords.y && coords.y < (virtualTagPosition.height + distance)));
            })
        };

        //showing the info window with the online/offline tags
        $scope.showOfflineTagsIndoor = () => {
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);
            dataService.showOfflineTags('canvas', constantUpdateCanvas, null);
        };

        //showing the info window with the online/offline anchors
        $scope.showOfflineAnchorsIndoor = () => {
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);
            dataService.showOfflineAnchorsIndoor('canvas', constantUpdateCanvas, null);
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
                    $scope.safeTags          = null;
                    $scope.unsafeTags        = [];
                    $scope.data              = [];
                    $scope.evacuation_value  = lang.initEvacuation;
                    $scope.evacuation_button = 'background-red';
                    let evacuation_on        = false;

                    $scope.men = {
                        safe  : 0,
                        unsafe: 0
                    };

                    $scope.colors = ["#4BAE5A", "#E13044"];
                    $scope.labels = [lang.personInEvacuationZone, lang.lostPersons];

                    newSocketService.getData('get_emergency_info', {
                        location: dataService.location.name,
                        floor   : floor
                    }, (response) => {
                        if (!response.session_state)
                            window.location.reload();

                        $scope.safeTags   = response.result;
                        $scope.unsafeTags = tags.filter(t => !response.result.some(i => i.tag_name === t.name));

                        $scope.men.safe   = response.result.length;
                        $scope.men.unsafe = tags.length - response.result.length;

                        $scope.data = [$scope.men.safe, $scope.men.unsafe];
                    });

                    newSocketService.getData('get_evacuation', {}, (response) => {
                        console.log(response);
                        if (response.result == 1) {
                            evacuation_on            = true;
                            $scope.evacuation_button = 'background-green';
                            $scope.evacuation_value  = lang.reset;
                        } else {
                            $scope.evacuation_on     = false;
                            $scope.evacuation_button = 'background-red';
                            $scope.evacuation_value  = lang.initEvacuation;
                        }
                    });

                    $scope.sendEvacuation = () => {
                        console.log('evacuation is: ', evacuation_on);
                        if (evacuation_on == false) {
                            newSocketService.getData('set_evacuation', {}, (response) => {
                                if (response.result > 0) {
                                    evacuation_on            = true;
                                    $scope.evacuation_button = 'background-green';
                                    $scope.evacuation_value  = lang.reset;
                                }
                            });
                        } else {
                            newSocketService.getData('stop_evacuation', {}, (response) => {
                                if (response.result > 0) {
                                    evacuation_on            = false;
                                    $scope.evacuation_button = 'background-red';
                                    $scope.evacuation_value  = lang.initEvacuation;
                                }
                            })
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
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);
        });

        /**
         * Functiont that draws a line on the canvas
         * @param begin
         * @param end
         * @param type
         * @param drawingContext
         * @param showDrawing
         */
        let drawLine = (begin, end, type, drawingContext, showDrawing) => {;
            drawingContext.setLineDash([]);
            drawingContext.lineWidth   = 2;
            drawingContext.strokeStyle = 'black';

            if (type === 'vertical') {
                if (showDrawing) {
                    drawRect(begin, drawingContext);
                    drawRect({x: begin.x, y: end.y}, drawingContext);
                }
                drawingContext.beginPath();
                drawingContext.moveTo(begin.x, begin.y);
                drawingContext.lineTo(begin.x, end.y);
            } else if (type === 'horizontal') {
                if (showDrawing) {
                    drawRect(begin, drawingContext);
                    drawRect({x: end.x, y: begin.y}, drawingContext);
                }
                drawingContext.beginPath();
                drawingContext.moveTo(begin.x, begin.y);
                drawingContext.lineTo(end.x, begin.y);
            } else if (type === 'inclined') {
                if (showDrawing) {
                    drawRect(begin, drawingContext);
                    drawRect(end, drawingContext);
                }
                drawingContext.beginPath();
                drawingContext.moveTo(begin.x, begin.y);
                drawingContext.lineTo(end.x, end.y)
            }
            drawingContext.stroke();
            drawingContext.closePath();
        }
    }
})();