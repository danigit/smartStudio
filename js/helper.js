/**
 * Function that draw the border of the canvas
 * @param canvasWidth
 * @param canvasHeight
 * @param context - the context of the canvas
 */
function drawCanvasBorder(canvasWidth, canvasHeight, context) {
    context.fillStyle = '#0093c4';

    //drawing the border
    context.beginPath();
    context.fillRect(0, 0, canvasWidth, canvasBorderSpace);
    context.fillRect(0, 0, canvasBorderSpace, canvasHeight);
    context.fillRect(0, canvasHeight - canvasBorderSpace, canvasWidth, canvasBorderSpace);
    context.fillRect(canvasWidth - canvasBorderSpace, 0, canvasWidth, canvasHeight);
    context.stroke();
}

/**
 * Function that encodes the request to be sent to the server in a json object
 * @param action - the type of the request
 * @param data - the data of the request
 * @returns {string} - json object with the encoded request
 */
function encodeRequest(action, data) {
    return JSON.stringify({action: action, data: data});
}

function encodeRequestWithId(id, action, data) {
    return JSON.stringify({id: id, action: action, data: data});
}

function parseResponse(response) {
    return JSON.parse(response.data);
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
function drawDashedLine(canvasWidth, canvasHeight, context, spacing, floorWidth, direction) {
    let virtualWidth    = scaleSize(floorWidth, canvasWidth) * spacing;
    context.strokeStyle = 'lightgray';

    if (direction === 'horizontal') {
        for (let i = canvasBorderSpace; i < canvasHeight - canvasBorderSpace; i += virtualWidth) {
            context.beginPath();
            context.setLineDash(canvasGridPattern);
            context.moveTo(canvasBorderSpace, i);
            context.lineTo(canvasWidth - canvasBorderSpace, i);
            context.stroke();
        }
    } else if (direction === 'vertical') {
        for (let i = canvasBorderSpace; i < canvasWidth - canvasBorderSpace; i += virtualWidth) {
            context.beginPath();
            context.setLineDash(canvasGridPattern);
            context.moveTo(i, canvasBorderSpace);
            context.lineTo(i, canvasHeight - canvasBorderSpace);
            context.stroke();
        }
    }
    context.closePath();
}

/**
 * Function that clear the canvas and redraw the background and the border
 * @param canvasWidth
 * @param canvasHeight
 * @param context
 * @param image
 */
function updateCanvas(canvasWidth, canvasHeight, context, image) {
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    if (image !== undefined) {
        context.drawImage(image, 0, 0);
        context.stroke();
    }

    drawCanvasBorder(canvasWidth, canvasHeight, context);
}


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
function drawIcon(value, context, img, width, canvasWidth, canvasHeight, isTag) {
    let id         = 0;
    let realHeight = (width * canvasHeight) / canvasWidth;

    let virtualRadius = scaleSize(width, canvasWidth) * value.radius;
    let virtualTag    = scaleIconSize(value.x_pos, value.y_pos, width, realHeight, canvasWidth, canvasHeight);

    context.beginPath();
    if (isTag) {
        context.fillStyle = 'red';
        // (value.id < 10) ? id = '0' + value.id : id = value.id;
        context.fillText(value.name, virtualTag.width - 5, virtualTag.height - 3);
    } else {
        context.fillStyle = '#0093c4';
        context.fillRect(virtualTag.width - 13, virtualTag.height - 17, 46, 16);
        context.fillStyle = 'white';
        // (value.id < 10) ? id = '0' + value.id : id = value.id;
        id = value.name;
        context.fillText(id, virtualTag.width - 12, virtualTag.height - 5);
    }

    context.drawImage(img, virtualTag.width, virtualTag.height);
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
}

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
function drawCloudIcon(value, context, img, width, canvasWidth, canvasHeight, tagsNumber) {
    let id         = 0;
    let realHeight = (width * canvasHeight) / canvasWidth;
    let virtualTag = scaleIconSize(value.x_pos, value.y_pos, width, realHeight, canvasWidth, canvasHeight);

    context.beginPath();
    context.fillStyle = 'red';
    (tagsNumber < 10) ? id = '0' + tagsNumber : id = tagsNumber;
    context.fillText(id, virtualTag.width + 9, virtualTag.height - 3);

    context.drawImage(img, virtualTag.width, virtualTag.height);
    context.strokeStyle = '#ff000015';
    context.stroke();
    context.closePath();
}

/**
 * Function that scales the size of the real map in the size of the image map
 * @param width - real map width
 * @param canvasWidth
 * @returns {number}
 */
function scaleSize(width, canvasWidth) {
    return (100 / width) * (canvasWidth / 100);
}

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
function scaleIconSize(width, height, realWidth, realHeight, canvasWidth, canvasHeight) {
    let scaledSize = {
        width : 0,
        height: 0
    };

    let realPercentX = (width * 100) / parseInt(realWidth);
    let realPercentY = (height * 100) / parseInt(realHeight);

    scaledSize.width  = (realPercentX * canvasWidth) / 100;
    scaledSize.height = (realPercentY * canvasHeight) / 100;

    return scaledSize;
}

/**
 * Function that shows the element passed as parameter in full screen
 * @param elem
 */
function openFullScreen(elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { /* Firefox */
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE/Edge */
        elem.msRequestFullscreen();
    }
}

/**
 * Function that converts an image to a base 64 string
 * @param img
 * @returns {Promise<any>}
 */
function convertImageToBase64(img) {
    if (img == null)
        return Promise.resolve(null);

    let image = new Image();

    let canvas  = document.createElement('canvas');
    let context = canvas.getContext('2d');
    let data    = '';

    return new Promise(function (resolve) {

        image.onload = function () {
            canvas.height = this.height;
            canvas.width  = this.width;

            context.drawImage(image, 0, 0);
            data = canvas.toDataURL('image/png');

            resolve(data);
        };

        image.src = URL.createObjectURL(img);
    })
}

/**
 * Function that scales the size from the canvas to the real size
 * @param floorWidth
 * @param canvasWidth
 * @param canvasHeight
 * @param elemWidth
 * @param elemHeight
 * @returns {{x: string, y: string}}
 */
function scaleSizeFromVirtualToReal(floorWidth, canvasWidth, canvasHeight, elemWidth, elemHeight) {
    let realHeight       = (floorWidth * canvasHeight) / canvasWidth;
    let reversePositionX = ((elemWidth * floorWidth * 100) / canvasWidth) / 100;
    let reversePositionY = ((elemHeight * realHeight * 100) / canvasHeight) / 100;

    return {x: reversePositionX.toFixed(2), y: reversePositionY.toFixed(2)};
}

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
 */
function updateDrawingCanvas(dataService, lines, canvasWidth, canvasHeight, canvasContext, image, map_spacing, floorWidth, showDrawing, anchorPositioning) {
    // console.log('showdrawing: ', showDrawing);
    updateCanvas(canvasWidth, canvasHeight, canvasContext, image);

    drawDashedLine(canvasWidth, canvasHeight, canvasContext, map_spacing, floorWidth, 'vertical');
    //drawing horizontal lines
    drawDashedLine(canvasWidth, canvasHeight, canvasContext, map_spacing, floorWidth, 'horizontal');

    lines.forEach((line) => {
        drawLine(line.begin, line.end, line.type, canvasContext, showDrawing);
    });


    if (showDrawing && anchorPositioning) {
        dataService.loadImagesAsynchronouslyWithPromise(dataService.anchors, 'anchor').then(
            function (allImages) {
                allImages.forEach(function (image, index) {
                    drawIcon(dataService.anchors[index], canvasContext, image, floorWidth, canvasWidth, canvasHeight, false);
                })
            }
        )
    }
}

/**
 * Functiont that draws a line on the canvas
 * @param begin
 * @param end
 * @param type
 * @param drawingContext
 * @param showDrawing
 */
function drawLine(begin, end, type, drawingContext, showDrawing) {;
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

/**
 * Function that draws a rectangle on the canvas
 * @param begin
 * @param drawingContext
 */
function drawRect(begin, drawingContext) {
    drawingContext.beginPath();
    drawingContext.fillStyle = 'black';
    drawingContext.fillRect(begin.x - 5, begin.y - 5, 10, 10);
    drawingContext.closePath();
}

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
// drawIcon(objects[index], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, false);
function drawZoneRect(begin, drawingContext, floorWidth, canvasWidth, canvasHeight, color, drawingOn, alpha) {
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

}

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
// drawIcon(objects[index], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, false);
function drawZoneRectFromDrawing(begin, drawingContext, floorWidth, canvasWidth, canvasHeight, color, alpha) {

    let width  = begin.xx - begin.x;
    let height = begin.yy - begin.y;

    drawingContext.beginPath();
    drawingContext.fillStyle = 'black';
    drawingContext.fillRect(begin.x - 5, begin.y - 5, 10, 10);
    drawingContext.globalAlpha = alpha;
    drawingContext.fillStyle = color;
    drawingContext.fillRect(begin.x, begin.y, width, height);
    drawingContext.globalAlpha = 1.0;
    drawingContext.stroke();
    drawingContext.closePath();
}

function findZone(coords, zones, floor, canvasWidth, canvasHeight) {
    let findedZones = [];
    let realcoords = scaleSizeFromVirtualToReal(floor, canvasWidth, canvasHeight, coords.x, coords.y);
    zones.forEach((z) => {
        console.log(z)
        console.log(realcoords);
        if ((realcoords.x > z.x_left && realcoords.x < z.x_right && realcoords.y > z.y_up && realcoords.y < z.y_down)) {
            findedZones.push(z.id);
        }
    });

    return findedZones;
}