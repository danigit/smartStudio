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
                    if (d.dist < TAG_CLOUD_DISTANCE && !indexes.some(t => d.tag === t)){
                        indexes.push(d.tag);
                        return true;
                    }
                });

                if (cloud.length > 1)
                    clouds.push(cloud);
                else if (cloud.length === 1)
                    singleTags.push(cloud[0])

            }
            return {clouds: clouds, single: singleTags}
        };

        canvas_service.calculateDistances = (tags) => {
            let distances = new Array(tags.length);

            for(let i = 0; i < tags.length; i++){
                distances[i] = new Array(tags.length).fill(0);
                for(let j = 0; j < tags.length; j++){
                    distances[i][j] = {tag: tags[j].id, dist: canvas_service.calculateDistance(tags[i], tags[j])};
                }
            }
            return distances;
        };

        canvas_service.calculateDistance = (tag1, tag2) => {
            let x_dist = Math.abs(tag1.x_pos - tag2.x_pos);
            let y_dist = Math.abs(tag1.y_pos - tag2.y_pos);

            return Math.hypot(x_dist, y_dist);
        }
    }
})();