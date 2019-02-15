/**
 * Function that draw the border of the canvas
 * @param canvasWidth - the width of the canvas
 * @param canvasHeight - the height of the canvas
 * @param context - the context of the canvas
 */
function drawCanvasBorder(canvasWidth, canvasHeight, context) {
    //setting the border properies
    context.fillStyle   = '#0093c4';

    //drawing the border
    context.beginPath();
    context.fillRect(0, 0, canvasWidth, canvasBorderSpace);
    context.fillRect(0, 0, canvasBorderSpace, canvasHeight);
    context.fillRect(0, canvasHeight - canvasBorderSpace, canvasWidth, canvasBorderSpace);
    context.fillRect(canvasWidth - canvasBorderSpace, 0, canvasWidth, canvasHeight);
    context.stroke();
}

function encodeRequest(action, data) {
    return JSON.stringify({action: action, data: data});
}

/**
 * Function that draws the vertical and horizontal lines on the canva
 * @param canvasWidth
 * @param canvasHeight
 * @param context
 * @param spacing
 * @param width
 * @param direction
 */
function drawDashedLine(canvasWidth, canvasHeight, context, spacing, width, direction) {
    let virtualWidth = scaleSize(width, canvasWidth) * spacing;
    console.log(virtualWidth);
    console.log(width);
    context.strokeStyle = 'lightgray';

    if (direction === 'horizontal') {
        for (let i = 25; i < canvasHeight - canvasBorderSpace; i += virtualWidth){
            context.beginPath();
            context.setLineDash(canvasGridPattern);
            context.moveTo(canvasBorderSpace, i);
            context.lineTo(canvasWidth - canvasBorderSpace, i);
            context.stroke();
        }
    }else if (direction === 'vertical'){
        for (let i = 25; i < canvasWidth - canvasBorderSpace; i += virtualWidth){
            context.beginPath();
            context.setLineDash(canvasGridPattern);
            context.moveTo(i, canvasBorderSpace);
            context.lineTo(i, canvasHeight - canvasBorderSpace);
            context.stroke();
        }
    }
}

function updateCanvas(canvasWidth, canvasHeight, context, image) {
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    if (image !== undefined) {
        context.drawImage(image, 0, 0);
        context.stroke();
    }
    drawCanvasBorder(canvasWidth, canvasHeight, context, 25);
}


function drawIcon(value, context, img, width, canvas, isTag) {
    let id = 0;

    let virtualRadius = scaleSize(width, canvas) * value.radius;
    context.beginPath();
    if (isTag){
        context.fillStyle = 'red';
        (value.id < 10) ? id = '0' + value.id : id = value.id;
        context.fillText(id, value.x_pos + 5, value.y_pos - 3);
    } else {
        context.fillStyle = '#0093c4';
        context.fillRect(value.x_pos, value.y_pos - 17, 17, 16);
        context.fillStyle = 'white';
        (value.id < 10) ? id = '0' + value.id : id = value.id;
        context.fillText(id, value.x_pos + 2, value.y_pos - 5);
    }

    context.drawImage(img, value.x_pos, value.y_pos);
    context.strokeStyle = '#ff000015';
    context.stroke();
    if (value.radius > 0){
        context.beginPath();
        context.setLineDash([]);
        context.arc(value.x_pos + 5, value.y_pos - 6, virtualRadius, 0, 2 * Math.PI);
        context.fillStyle = '#ff000009';
        context.fill();
        context.stroke();
    }
}

function scaleSize(width, canvasWidth) {
    return (100/width) * (canvasWidth/100);
}

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

function convertImageToBase64(img) {
    if (img == null)
        return;

    let image = new Image();
    image.src = URL.createObjectURL(img);

    let canvas = document.createElement('canvas');
    let context = canvas.getContext('2d');
    let data = '';

    return new Promise(function (resolve) {

        image.onload = function() {
            canvas.height = this.height;
            canvas.width  = this.width;

            context.drawImage(image, 0, 0);
            data = canvas.toDataURL('image/png');

            resolve(data);
        }
    })
}