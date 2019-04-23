/***************************************************************
 * DIRECTORIES PATHS
 ***************************************************************/
const mainPath = '../SMARTSTUDIO/';
const componentsPath = '../SMARTSTUDIO/components/';
const imagePath = '../SMARTSTUDIO/img/';
const iconsPath = '../SMARTSTUDIO/img/icons/';
const menuIconsPath = '../SMARTSTUDIO/img/icons/menu/';
const markersIconPath = '../SMARTSTUDIO/img/icons/markers/';
const tagsIconPath = '../SMARTSTUDIO/img/icons/tags/';
const resourcePath = '../SMARTSTUDIO/resources/';
const audioPath = '../SMARTSTUDIO/resources/audio/';
const floorPath = '../SMARTSTUDIO/img/floors/';

/***************************************************************
 * CANVAS DEFAULT VARIABLES
 ***************************************************************/
const canvasBorderSpace = 25;
const canvasGridPattern = [5, 5];

/***************************************************************
 * MAPS COFIGURATIONS
 ***************************************************************/
const mapZoom = 10;
const mapType = 'TERAIN';
const mapCenter = [41.87194, 12.56738];

let requestId = 0;

let mapConfiguration = [{
    featureType: "poi",
    elementType: "labels",
    stylers    : [
        {visibility: "off"}
    ]
}, {
    featureType: "water",
    elementType: "labels",
    stylers    : [
        {visibility: "off"}
    ]
}, {
    featureType: "road",
    elementType: "labels",
    stylers    : [
        {visibility: "off"}
    ]
}];