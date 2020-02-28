(function () {
    'use strict';

    //reloading angular module and creating the home service
    angular.module('main').service('canvasService', canvasService);

    canvasService.$inject = ['$mdDialog', '$interval', '$state', 'newSocketService', 'dataService'];

    function canvasService($mdDialog, $interval, $state, newSocketService, dataService) {
        let canvas_service = this;

        /**
         * Setting the default floor of the location
         */
        canvas_service.setDefaultFloor = (canvasCtrl) => {
            //controlling if the floor is already setted, if not i set it to the first floor in the building
            if (dataService.defaultFloorName === '') {
                canvasCtrl.defaultFloor      = [dataService.floors[0]];
                dataService.defaultFloorName = dataService.floors[0].name;
            } else {
                canvasCtrl.defaultFloor = dataService.userFloors.filter(f => f.name === dataService.defaultFloorName);
            }
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
            console.log('drawing grid')
            let virtualWidth    = canvas_service.scaleSize(floorWidth, canvasWidth) * spacing;
            context.strokeStyle = CANVAS_GRID_COLOR;

            canvas_service.canvasLines(canvasWidth, canvasHeight, context, virtualWidth,false);
            canvas_service.canvasLines(canvasWidth, canvasHeight, context, virtualWidth, true);

            context.closePath();
        };

        canvas_service.canvasLines = (canvasWidth, canvasHeight, context, virtualWidth, horizontal) => {
            let canvasLength = (horizontal) ? canvasHeight : canvasWidth
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
         * Function that scales the size of the real map in the size of the image map
         * @param width - real map width
         * @param canvasWidth
         * @returns {number}
         */
        canvas_service.scaleSize = (width, canvasWidth) => {
            return (100 / width) * (canvasWidth / 100);
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
                    if (d.dist < TAG_CLOUD_DISTANCE && !indexes.some(t => d.tag.id === t)){
                        indexes.push(d.tag.id);
                        return true;
                    }
                });

                if (cloud.length > 1) {
                    clouds.push(cloud.map(c => c.tag));
                }else if (cloud.length === 1)
                    singleTags.push(cloud[0].tag)

            }
            return {clouds: clouds, single: singleTags}
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
                    distances[i][j] = {tag: tags[j], dist: canvas_service.calculateDistance(tags[i], tags[j])};
                }
            }
            return distances;
        };

        /**
         * Function that calculates the distance between two tags
         * @param tag1
         * @param tag2
         * @returns {number}
         */
        canvas_service.calculateDistance = (tag1, tag2) => {
            let x_dist = Math.abs(tag1.x_pos - tag2.x_pos);
            let y_dist = Math.abs(tag1.y_pos - tag2.y_pos);

            return Math.hypot(x_dist, y_dist);
        };

        canvas_service.loadTagsImages = (tagClouds) => {
            if (tagClouds.length === 0) {
                return Promise.resolve(null);
            } else {
                //loading all the images asynchronously
                return Promise.all(
                    tagClouds.map(function (value) {
                        return new Promise(function (resolve) {
                            let img = new Image();

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

                            img.onload = function () {
                                resolve(img);
                            }
                        })
                    })
                )
            }
        }

        canvas_service.loadTagCloudsImages = (tagClouds, onAllLoaded) => {
            let i, numLoading = tagClouds.length;
            const onload = () => --numLoading === 0 && onAllLoaded(images);
            const images = [];
            for(i = 0; i < tagClouds.length; i++){
                const img = new Image();
                images.push(img);
                let tagState = dataService.checkTagsStateAlarmNoAlarmOffline(tagClouds[i]);
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
                }
                img.onload = onload;
            }
            return images;
        }

        canvas_service.loadTagSingleImages = (tagClouds, onAllLoaded) => {
            let i, numLoading = tagClouds.length;
            const onload = () => --numLoading === 0 && onAllLoaded(images);
            const images = [];
            for(i = 0; i < tagClouds.length; i++){
                const img = new Image();
                images.push(img);
                if (dataService.checkIfTagHasAlarm(tagClouds[i])) {
                    dataService.assigningTagImage(tagClouds[i], img);
                } else if (dataService.isTagOffline(tagClouds[i])) {
                    dataService.assigningTagImage(tagClouds[i], img);
                    // img.src = tagsIconPath + 'offline_tag_24.png';
                } else {
                    dataService.assigningTagImage(tagClouds[i], img);
                    // img.src = tagsIconPath + 'online_tag_24.png';
                }
                img.onload = onload;
            }
            return images;
        }






















































    }
})();