(function () {
    'use strict';

    //reloading angular module and creating the home service
    angular.module('main').service('canvasService', canvasService);

    canvasService.$inject = ['$mdDialog', '$interval', '$state', 'newSocketService', 'dataService'];

    function canvasService($mdDialog, $interval, $state, newSocketService, dataService) {
        let canvas_service = this;

        /**
         * Setting the default floor of the location
         * @param canvasCtrl
         */
        canvas_service.setDefaultFloor = (canvasCtrl) => {
            //controlling if the floor is already setted, if not i set it to the first floor in the building
            if (dataService.defaultFloorName === '') {
                canvasCtrl.defaultFloor      = [dataService.floors[0]];
                dataService.defaultFloorName = dataService.floors[0].name;
            } else {
                canvasCtrl.defaultFloor = dataService.userFloors.filter(f => f.name === dataService.defaultFloorName);
            }
        };

        canvas_service.changeFloor = (canvas, context, canvasCtrl, canvasImage, newValue) => {

            if (newValue !== undefined)
                canvasCtrl.defaultFloor = [dataService.userFloors.find(f => f.name === newValue)];

            canvasCtrl.floorData.defaultFloorName = canvasCtrl.defaultFloor[0].name;
            canvasCtrl.floorData.defaultFloorId = canvasCtrl.defaultFloor[0].id;
            dataService.defaultFloorName = canvasCtrl.defaultFloor[0].name;
            canvasCtrl.floorData.gridSpacing = canvasCtrl.defaultFloor[0].map_spacing;
            canvasCtrl.floorData.floor_image_map = canvasCtrl.defaultFloor[0].image_map;
            canvasImage.src = floorPath + canvasCtrl.floorData.floor_image_map;

            context.clearRect(0, 0, canvas.width, canvas.height);
        }

        /**
         * Function that draws the grid on the canvas
         * @param canvasWidth
         * @param canvasHeight
         * @param context
         * @param spacing
         * @param floorWidth
         * @param direction
         */
        canvas_service.drawDashedLine = (canvasWidth, canvasHeight, context, spacing, floorWidth) => {
            let virtualWidth    = canvas_service.scaleSize(floorWidth, canvasWidth) * spacing;
            context.strokeStyle = CANVAS_GRID_COLOR;

            canvas_service.canvasLines(canvasWidth, canvasHeight, context, virtualWidth,false);
            canvas_service.canvasLines(canvasWidth, canvasHeight, context, virtualWidth, true);

            context.closePath();
        };

        /**
         * Function that draws the vertical and horizontal lines on the canvas
         * @param canvasWidth
         * @param canvasHeight
         * @param context
         * @param virtualWidth
         * @param horizontal
         */
        canvas_service.canvasLines = (canvasWidth, canvasHeight, context, virtualWidth, horizontal) => {
            let canvasLength = (horizontal) ? canvasHeight : canvasWidth;
            for (let i = canvasBorderSpace; i < canvasLength - canvasBorderSpace; i += virtualWidth) {
                context.beginPath();
                context.setLineDash(canvasGridPattern);
                if (horizontal) {
                    context.moveTo(canvasBorderSpace, i);
                    context.lineTo(canvasWidth - canvasBorderSpace, i);
                } else{
                    context.moveTo(i, canvasBorderSpace);
                    context.lineTo(i, canvasHeight - canvasBorderSpace);
                }
                context.stroke();
            }
        };

        /**
         * Function that creates the tag clouds and the single tags
         * @param tags
         */
        canvas_service.createClouds = (tags) => {
            // getting the distances between tags
            let tagsDistances = canvas_service.calculateDistances(tags);
            let clouds = [];
            let singleTags = [];
            let cloud = null;
            let indexes = [];

            for (let i = 0; i < tagsDistances.length; i++){
                cloud = tagsDistances[i].filter((d) => {
                    if (d.dist < TAG_CLOUD_DISTANCE && !indexes.some(t => d.tag.id === t)) {
                        indexes.push(d.tag.id);
                        return true;
                    }
                });

                // cloud = cloud.filter(ce => canvas_service.selectCloudTag(ce.tag));
                // console.log(cloud)
                if (cloud.length > 1) {
                    clouds.push(cloud.map(c => c.tag));
                } else if (cloud.length === 1) {
                    singleTags.push(cloud[0].tag)
                }
            }
            return {clouds: clouds, single: singleTags}
        };

        canvas_service.selectCloudTag = (tag) => {
            return !dataService.hasTagSuperatedSecondDelta(tag)
        };

        /**
         * Function that draws the icon of a cloud of tags
         * @param value - the informations of a tha inside the cloud
         * @param context
         * @param img
         * @param width
         * @param canvasWidth
         * @param canvasHeight
         * @param tagsNumber - the number of the tags in the cloud
         */
        canvas_service.drawCloudIcon = (value, context, img, width, canvasWidth, canvasHeight, tagsNumber) => {
            let id         = 0;
            let realHeight = (width * canvasHeight) / canvasWidth;
            let virtualTag = canvas_service.scaleIconSize(value.x_pos, value.y_pos, width, realHeight, canvasWidth, canvasHeight);

            context.beginPath();
            context.fillStyle = 'red';
            (tagsNumber < 10) ? id = '0' + tagsNumber : id = tagsNumber;
            context.fillText(id, virtualTag.width + 9, virtualTag.height - 3);

            context.drawImage(img, virtualTag.width, virtualTag.height);
            context.strokeStyle = '#ff000015';
            context.stroke();
            context.closePath();
        };

        /**
         * Function that calculates the distances between all the tags passed as parameter
         * @param tags
         * @returns {any[]}
         */
        canvas_service.calculateDistances = (tags) => {
            let distances = new Array(tags.length);

            for(let i = 0; i < tags.length; i++){
                distances[i] = new Array(tags.length).fill(0);
                for(let j = 0; j < tags.length; j++){
                    distances[i][j] = {tag: tags[j], dist: canvas_service.calculateDistance(tags[i].x_pos, tags[i].y_pos, tags[j].x_pos, tags[j].y_pos)};
                }
            }
            return distances;
        };

        /**
         * Function that calculates the distance between two tags
         * @returns {number}
         * @param tag1_x
         * @param tag1_y
         * @param tag2_x
         * @param tag2_y
         */
        canvas_service.calculateDistance = (tag1_x, tag1_y, tag2_x, tag2_y) => {
            let x_dist = Math.abs(tag1_x - tag2_x);
            let y_dist = Math.abs(tag1_y - tag2_y);

            return Math.hypot(x_dist, y_dist);
        };

        canvas_service.loadTagCloudsImages = (tagClouds) => {

            let i;
            let images = [];

            for(i = 0; i < tagClouds.length; i++) {

                let tagState = canvas_service.checkTagsStateAlarmNoAlarmOffline(tagClouds[i]);

                let img = new Image();

                if (tagState.withAlarm && tagState.withoutAlarm && tagState.offline) {
                    img = tagsImages.find(i => i.type === 'cumulative_tags_all_32.png').img;
                    img.alarm = false;
                    images.push(img);
                } else if (tagState.withAlarm && tagState.withoutAlarm && !tagState.offline) {
                    img = tagsImages.find(i => i.type === 'cumulative_tags_half_alert_32.png').img;
                    img.alarm = true;
                    images.push(img);
                } else if (tagState.withAlarm && !tagState.withoutAlarm && !tagState.offline) {
                    img = tagsImages.find(i => i.type === 'cumulative_tags_all_alert_32.png').img;
                    img.alarm = true;
                    images.push(img);
                } else if (tagState.withAlarm && !tagState.withoutAlarm && tagState.offline) {
                    img = tagsImages.find(i => i.type === 'cumulative_tags_offline_alert_32.png').img;
                    img.alarm = true;
                    images.push(img);
                } else if (!tagState.withAlarm && tagState.withoutAlarm && tagState.offline) {
                    img = tagsImages.find(i => i.type === 'cumulative_tags_offline_online_32.png').img;
                    img.alarm = true;
                    images.push(img);
                } else if (!tagState.withAlarm && !tagState.withoutAlarm && tagState.offline) {
                    img = tagsImages.find(i => i.type === 'cumulative_tags_offline_32.png').img;
                    img.alarm = true;
                    images.push(img);
                } else if (!tagState.withAlarm && tagState.withoutAlarm && !tagState.offline) {
                    img = tagsImages.find(i => i.type === 'cumulative_tags_32.png').img;
                    img.alarm = true;
                    images.push(img);
                }
            }

            return images;
        };

        /**
         * Function that check the situation of the tags passed as parameter (online, offline, alarm)
         * @param tags
         * @returns {{withoutAlarm: boolean, offline: boolean, withAlarm: boolean}}
         */
        canvas_service.checkTagsStateAlarmNoAlarmOffline = function (tags) {
            let tagState = {
                withAlarm   : false,
                withoutAlarm: false,
                offline     : false
            };

            tags.forEach(function (tag) {
                if (tag.sos || tag.man_down || tag.helmet_dpi || tag.belt_dpi || tag.glove_dpi || tag.shoe_dpi
                    || tag.man_in_quote
                    || tag.call_me_alarm || tag.diagnostic_request || tag.inside_zone) {
                    tagState.withAlarm = true;
                } else if (tag.battery_status && !dataService.hasTagReaperedAfterOffline(tag)) {
                    tagState.withAlarm = true
                } else if (dataService.isTagOffline(tag)) {
                    tagState.offline = true;
                } else if (!tag.radio_switched_off) {
                    tagState.withoutAlarm = true;
                }
            });

            return tagState;
        };

        /**
         * Function that load the single tags images
         * @param singleTags
         * @param onAllLoaded
         * @returns {[]}
         */
        canvas_service.loadTagSingleImages = (singleTags) => {

            let i;
            let images      = [];
            for (i = 0; i < singleTags.length; i++) {
                // if (dataService.checkIfTagHasAlarm(singleTags[i])) {
                images.push(dataService.assigningTagImage(singleTags[i]));
                // } else if (dataService.isTagOffline(singleTags[i])) {
                //     dataService.assigningTagImage(singleTags[i], img);
                //     img.src = tagsIconPath + 'offline_tag_24.png';
                // } else {
                //     dataService.assigningTagImage(singleTags[i], img);
                // img.src = tagsIconPath + 'online_tag_24.png';
                // }
            }
            return images;
        };

        /**
         * Function that loads the images for the alarms
         * @param alarmImages
         * @param onAllLoaded
         * @returns {[]}
         */
        canvas_service.loadAlarmImages = (alarmImages, onAllLoaded) => {
            let i, numLoading = alarmImages.length;
            const onload      = () => --numLoading === 0 && onAllLoaded(images);
            const images      = [];
            for (i = 0; i < alarmImages.length; i++) {
                const img = new Image();
                images.push(img);
                img.src    = alarmImages[i];
                img.onload = onload;
            }
            return images;
        };

        /**
         * Function that scales the size from the canvas to the real size
         * @param floorWidth
         * @param canvasWidth
         * @param canvasHeight
         * @param elemWidth
         * @param elemHeight
         * @returns {{x: string, y: string}}
         */
        canvas_service.scaleSizeFromVirtualToReal = (floorWidth, canvasWidth, canvasHeight, elemWidth, elemHeight) => {
            let ratio = floorWidth / canvasWidth;

            let reversePositionX = ratio * elemWidth;
            let reversePositionY = ratio * elemHeight;

            return {x: reversePositionX.toFixed(2), y: reversePositionY.toFixed(2)};
        };

        canvas_service.uniteLinesIfClose = (drawedLines, prevClick) => {
            let startUnion = drawedLines.find(l => canvas_service.calculateDistance(l.begin.x, l.begin.y, prevClick.x, prevClick.y) < LINE_UNION_SPACE);
            let endUnion   = drawedLines.find(l => canvas_service.calculateDistance(l.end.x, l.end.y, prevClick.x, prevClick.y) < LINE_UNION_SPACE);
            if (startUnion !== undefined) {
                return startUnion.begin;
            } else if (endUnion !== undefined) {
                return endUnion.end;
            }

            return prevClick;
        };

        canvas_service.createZoneObject = (zone, topLeft, bottomRight) => {
            zone.topLeft     = topLeft;
            zone.bottomRight = bottomRight;
            return zone;
        };

        canvas_service.findZones = (zones, coords, floor, canvasWidth, canvasHeight) => {
            let realcoords = scaleSizeFromVirtualToReal(floor, canvasWidth, canvasHeight, coords.x, coords.y);

            return zones.filter(z => (realcoords.x > z.x_left && realcoords.x < z.x_right && realcoords.y > z.y_up && realcoords.y < z.y_down)).map(z => z.id);
        };

        canvas_service.findDrawedZones = (zones, coords) => {
            return zones.filter(z => (coords.x > z.topLeft.x && coords.x < z.bottomRight.x && coords.y > z.topLeft.y && coords.y < z.bottomRight.y))
        };

        canvas_service.drawZones = (zones, drawedZones, context, floorWidth, width, height, drawingOn, zoneName, alpha) => {
            zones.forEach((zone) => {
                canvas_service.drawZoneRect({
                    x : zone.x_left,
                    y : zone.y_up,
                    xx: zone.x_right,
                    yy: zone.y_down
                }, context, floorWidth, width, height, zone.color, drawingOn, zoneName, alpha);
            });

            drawedZones.forEach((zone) => {
                canvas_service.drawZoneRectFromDrawing({
                    x : zone.topLeft.x,
                    y : zone.topLeft.y,
                    xx: zone.bottomRight.x,
                    yy: zone.bottomRight.y
                }, context, floorWidth, width, height, 'red', alpha);
            })
        };

        canvas_service.isElementAtClick = (virtualTagPosition, mouseDownCoords, distance) => {
            return canvas_service.calculateDistance(mouseDownCoords.x, mouseDownCoords.y, virtualTagPosition.width, virtualTagPosition.height) < distance
        };

        /**
         * Function that draw the border of the canvas
         * @param canvasWidth
         * @param canvasHeight
         * @param context - the context of the canvas
         */
        canvas_service.drawCanvasBorder = (canvasWidth, canvasHeight, context) => {
            context.fillStyle = '#0093c4';

            //drawing the border
            context.beginPath();
            context.fillRect(0, 0, canvasWidth, canvasBorderSpace);
            context.fillRect(0, 0, canvasBorderSpace, canvasHeight);
            context.fillRect(0, canvasHeight - canvasBorderSpace, canvasWidth, canvasBorderSpace);
            context.fillRect(canvasWidth - canvasBorderSpace, 0, canvasWidth, canvasHeight);
            context.stroke();
        };

        /**
         * Function that draws a rectangle on the canvas
         * @param begin
         * @param drawingContext
         */
        canvas_service.drawRect = (begin, drawingContext) => {
            drawingContext.beginPath();
            drawingContext.fillStyle = 'black';
            drawingContext.fillRect(begin.x - 5, begin.y - 5, 10, 10);
            drawingContext.closePath();
        };

        /**
         * Function that draws a rectangle on the canvas
         * @param begin
         * @param drawingContext
         * @param floorWidth
         * @param canvasWidth
         * @param canvasHeight
         * @param color
         * @param drawingOn
         * @param alpha
         */
        canvas_service.drawZoneRect = (begin, drawingContext, floorWidth, canvasWidth, canvasHeight, color, drawingOn, zoneName, alpha) => {
            let realHeight = (floorWidth * canvasHeight) / canvasWidth;

            let virtualPositionTop    = scaleIconSize(begin.x, begin.y, floorWidth, realHeight, canvasWidth, canvasHeight);
            let virtualPositionBottom = scaleIconSize(begin.xx, begin.yy, floorWidth, realHeight, canvasWidth, canvasHeight);

            let width  = virtualPositionBottom.width - virtualPositionTop.width;
            let height = virtualPositionBottom.height - virtualPositionTop.height;

            drawingContext.beginPath();
            if (drawingOn) {
                drawingContext.fillStyle = 'black';
                drawingContext.fillRect(virtualPositionTop.width - 5, virtualPositionTop.height - 5, 10, 10);
            }
            drawingContext.globalAlpha = alpha;
            drawingContext.fillStyle   = color;
            drawingContext.fillRect(virtualPositionTop.width | 0, virtualPositionTop.height | 0, width | 0, height | 0);
            drawingContext.globalAlpha = 1.0;
            drawingContext.stroke();
            drawingContext.closePath();

            drawingContext.beginPath();
            drawingContext.fillStyle = 'black';
            drawingContext.fillText(zoneName, virtualPositionTop.width | 0 + 5, virtualPositionTop.height | 0 + 10);
        };

        /**
         * Function that draws a rectangle on the canvas
         * @param begin
         * @param drawingContext
         * @param floorWidth
         * @param canvasWidth
         * @param canvasHeight
         * @param color
         * @param alpha
         */
        canvas_service.drawZoneRectFromDrawing = (begin, drawingContext, floorWidth, canvasWidth, canvasHeight, color, alpha) => {

            let width  = begin.xx - begin.x;
            let height = begin.yy - begin.y;

            drawingContext.beginPath();
            drawingContext.fillStyle = 'black';
            drawingContext.fillRect(begin.x - 5, begin.y - 5, 10, 10);
            drawingContext.globalAlpha = alpha;
            drawingContext.fillStyle   = color;
            drawingContext.fillRect(begin.x, begin.y, width, height);
            drawingContext.globalAlpha = 1.0;
            drawingContext.stroke();
            drawingContext.closePath();
        };


        /**
         * Functiont that draws a line on the canvas
         * @param begin
         * @param end
         * @param type
         * @param drawingContext
         * @param showDrawing
         */
        canvas_service.drawLine = (begin, end, type, drawingContext, showDrawing) => {
            drawingContext.setLineDash([]);
            drawingContext.lineWidth   = 2;
            drawingContext.strokeStyle = 'black';

            if (type === 'vertical') {
                if (showDrawing) {
                    canvas_service.drawRect(begin, drawingContext);
                    canvas_service.drawRect({x: begin.x, y: end.y}, drawingContext);
                }
                drawingContext.beginPath();
                drawingContext.moveTo(begin.x, begin.y);
                drawingContext.lineTo(begin.x, end.y);
            } else if (type === 'horizontal') {
                if (showDrawing) {
                    canvas_service.drawRect(begin, drawingContext);
                    canvas_service.drawRect({x: end.x, y: begin.y}, drawingContext);
                }
                drawingContext.beginPath();
                drawingContext.moveTo(begin.x, begin.y);
                drawingContext.lineTo(end.x, begin.y);
            } else if (type === 'inclined') {
                if (showDrawing) {
                    canvas_service.drawRect(begin, drawingContext);
                    canvas_service.drawRect(end, drawingContext);
                }
                drawingContext.beginPath();
                drawingContext.moveTo(begin.x, begin.y);
                drawingContext.lineTo(end.x, end.y)
            }
            drawingContext.stroke();
            drawingContext.closePath();
        };

        /**
         * Function that scales the size of the real map in the size of the image map
         * @param width - real map width
         * @param canvasWidth
         * @returns {number}
         */
        canvas_service.scaleSize = (width, canvasWidth) => {
            return (100 / width) * (canvasWidth / 100);
        };

        /**
         * Function that scales the size of the position of an icon respect to the measure in the real map
         * @param width
         * @param height
         * @param realWidth
         * @param realHeight
         * @param canvasWidth
         * @param canvasHeight
         * @returns {{width: number, height: number}}
         */
        canvas_service.scaleIconSize = (width, height, realWidth, realHeight, canvasWidth, canvasHeight) => {
            let scaledSize = {
                width : 0,
                height: 0
            };

            let ratio = canvasWidth / realWidth;

            scaledSize.width  = ratio * width;
            scaledSize.height = ratio * height;

            return scaledSize;
        };

        /**
         * Function that draw an image on the canvas
         * @param value - informations of the object to be drawn
         * @param context
         * @param img
         * @param width
         * @param canvasWidth
         * @param canvasHeight
         * @param isTag - true if the object to be drawn is a tag
         */
        canvas_service.drawIcon = (value, context, img, width, canvasWidth, canvasHeight, isTag) => {
            let id         = 0;
            let realHeight = (width * canvasHeight) / canvasWidth;

            let virtualRadius = canvas_service.scaleSize(width, canvasWidth) * value.radius;
            let virtualTag    = canvas_service.scaleIconSize(value.x_pos, value.y_pos, width, realHeight, canvasWidth, canvasHeight);

            context.beginPath();
            if (isTag) {
                context.fillStyle = 'red';
                context.fillText(value.name, virtualTag.width - 10, virtualTag.height - 14);
            } else {
                context.fillStyle = '#0093c4';
                id = value.name;
                context.fillText(id, virtualTag.width - 17, virtualTag.height - 15);
            }

            context.drawImage(img, virtualTag.width - 10, virtualTag.height - 10);
            context.strokeStyle = '#ff000015';
            context.stroke();
            if (value.radius > 0) {
                context.beginPath();
                context.setLineDash([]);
                context.arc(virtualTag.width + 5, virtualTag.height - 6, virtualRadius, 0, 2 * Math.PI);
                context.fillStyle = '#ff000009';
                context.fill();
                context.stroke();
            }
            context.closePath();
        };

        /**
         * Function that loads the anchors images
         * @param anchors
         * @param onAllLoaded
         * @returns {[]}
         */
        canvas_service.loadAnchorsImages = (anchors) => {
            let images = [];
            let i;

            for(i = 0; i < anchors.length; i++){
                if (anchors[i].anchor_type_id === 5){
                    if(!anchors[i].is_offline){
                        images.push(anchorsImages.find(i => i.type === 'access_anchor_online_32.png'))
                    }else if(anchors[i].is_offline){
                        images.push(anchorsImages.find(i => i.type === 'access_anchor_offline_32.png'))
                    }
                }else{
                    if (!anchors[i].is_offline){
                        images.push(anchorsImages.find(img => img.type === 'anchor_online_16.png'))
                    }else if (anchors[i].is_offline){
                        images.push(anchorsImages.find(img => img.type === 'anchor_offline_16.png'))
                    }
                }
            }
            return images;
        };

        /**
         * Function that loads the cameras images
         * @returns {[]}
         * @param cameras
         * @param onAllLoaded
         */
        canvas_service.loadCamerasImages = (cameras) => {
            let i;
            let images = [];
            for(i = 0; i < cameras.length; i++){
                if (!cameras[i].is_offline)
                    images.push(camerasImages.find(img => img.type === 'camera_online_24.png'))
                else if (cameras[i].is_offline)
                    images.push(camerasImages.find(img => img.type === 'camera_offline_24.png'))
            }
            return images;
        };

        /**
         * Function that clears the canvas and drawing the background and the grid system
         * @param dataService
         * @param lines
         * @param canvasWidth
         * @param canvasHeight
         * @param canvasContext
         * @param image
         * @param map_spacing
         * @param floorWidth
         * @param showDrawing
         * @param anchorPositioning
         */
        canvas_service.updateDrawingCanvas = (dataService, lines, canvasWidth, canvasHeight, canvasContext, image, map_spacing, floorWidth, showDrawing, anchorPositioning) => {
            canvas_service.updateCanvas(canvasWidth, canvasHeight, canvasContext, image);

            canvas_service.drawDashedLine(canvasWidth, canvasHeight, canvasContext, map_spacing, floorWidth, 'vertical');
            //drawing horizontal lines
            canvas_service.drawDashedLine(canvasWidth, canvasHeight, canvasContext, map_spacing, floorWidth, 'horizontal');

            lines.forEach((line) => {
                canvas_service.drawLine(line.begin, line.end, line.type, canvasContext, showDrawing);
            });

            if (showDrawing && anchorPositioning) {
                canvas_service.loadAnchorsImages(dataService.anchors, (images) => {
                    images.forEach((image, index) => {
                        canvas_service.drawIcon(dataService.anchors[index], canvasContext, image, floorWidth, canvasWidth, canvasHeight, false);
                    })
                })
            }
        };

        /**
         * Function that clear the canvas and redraw the background and the border
         * @param canvasWidth
         * @param canvasHeight
         * @param context
         * @param image
         */
        canvas_service.updateCanvas = (canvasWidth, canvasHeight, context, image) => {
            context.clearRect(0, 0, canvasWidth, canvasHeight);
            if (image !== undefined) {
                context.drawImage(image, 0, 0);
                context.stroke();
            }

            canvas_service.drawCanvasBorder(canvasWidth, canvasHeight, context);
        };

        /**
         * Controlling if at the clicked point there is at least a single tag
         * @param singleTags
         * @param floorWidth
         * @param canvas
         * @param realHeight
         * @param mouseDownCoords
         * @returns {boolean}
         */
        canvas_service.singleTagAtPosition = (singleTags, floorWidth, canvas, realHeight, mouseDownCoords) => {
            return singleTags.some(st => {
                let virtualTagPosition = scaleIconSize(st.x_pos, st.y_pos, floorWidth, realHeight, canvas.width, canvas.height);
                return canvas_service.isElementAtClick(virtualTagPosition, mouseDownCoords, CANVAS_TAG_ICON_SIZE)
            });
        };

        canvas_service.isAnchorInZone = (anchor, zone) => {
            return (anchor.x_pos > zone.x_left && anchor.x_pos < zone.x_right && anchor.y_pos > zone.y_up && anchor.y_pos < zone.y_down);
        }

        canvas_service.isElementInsideZone = (element, zone) => {
            return (element.x_pos > zone.x_left && element.x_pos < zone.x_right && element.y_pos > zone.y_up && element.y_pos < zone.y_down);
        }

        canvas_service.getLocationTags = (location) => {

            let tempTotalTags = [];
            return new Promise(resole => {
                newSocketService.getData('get_all_tags', {}, allTags => {
                    newSocketService.getData('get_anchors_by_location', {
                        location: location
                    }, locationAnchors => {

                        // computing the total number of tags in location
                        locationAnchors.result.forEach(a => {
                            allTags.result.filter(t => !t.radio_switched_off).forEach(t => {

                                if(t.anchor_id === a.id.toString()){
                                    tempTotalTags.push(t);
                                }
                            })
                        });

                        resole(tempTotalTags);
                    })
                })
            })
        }
    }
})();