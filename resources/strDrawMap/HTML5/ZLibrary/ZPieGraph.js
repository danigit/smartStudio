/*
 ***********************************************************
 ** ZPieGraph - Gestione dei grafici a torta
 ** Versione 1.1  06 Febbraio 2018
 **               NEW: Aggiunta la possibilità di visualizzare i dati
 **                    espressi non come percentuale ma come rapporto 
 **                    sulla quantità totale
 ** Versione 1.0  02 Agosto 2016
 **               - Prima versione  
 ***********************************************************/
 
function TZPieGraph(NomeCanvas)
{
  // PRIVATE
  var FCanvas    = document.getElementById(NomeCanvas);
  var FContext   = FCanvas.getContext("2d");
  var FLsPercent = []; 
  
  // PUBLIC
  // Title definition
  this.Title               = 'Title';
  this.HeightTitle         = 20;
  this.BackgroundTitle     = 'navy';
  this.FontTitle           = "bold 12px Arial";
  this.FontColorTitle      = 'white';
  this.Font                = "bold 10px Arial";
  this.FontColor           = 'black';
  this.Background          = '#f8ffa7';
  this.ExternalRadius      = 90; // Expressed in percent of max possible radius
  this.InternalRadius      = 40;
  this.RowTextHeight       = 12;
  this.WidthBlockLegend    = 12;
  this.SpaceTextLegend     = 4;
  
  this.Refresh        = function()
  {
    // Colore dello sfondo 
    if(this.Background == "") 
      FContext.clearRect(0,0,FCanvas.width,FCanvas.height);
    else
    {
      FContext.fillStyle      = this.Background;
      FContext.fillRect(0,0,FCanvas.width,FCanvas.height);
    }
    FContext.fillStyle      = this.BackgroundTitle;
    FContext.fillRect(0,0,FCanvas.width,this.HeightTitle);
    FContext.font           = this.FontTitle;
    FContext.fillStyle      = this.FontColorTitle;
    FContext.fillText(this.Title, 
                      (FCanvas.width -  FContext.measureText(this.Title).width) / 2,
                      Math.floor((this.HeightTitle - GetTextHeight(this.Title,FContext)) / 2 + GetTextHeight(this.Title,FContext)) - 2);
                      
    // Grafici
          
    var StartAngle = 0;          
    var EndAngle = 0;
    var MaxRadius = Math.floor(FCanvas.width / 2);
    for(var Percent of FLsPercent)
       if(Percent.Value != 0)
       {
         let PercentValue = Percent.Total == undefined ? Percent.Value : (Percent.Value / Percent.Total) * 100;
         EndAngle = StartAngle + 2 * Math.PI * PercentValue / 100;
         if(EndAngle > 2 * Math.PI) EndAngle = 2 * Math.PI;
         let cx = MaxRadius; let cy = MaxRadius + this.HeightTitle + 3;
         let Radius = MaxRadius * this.ExternalRadius / 100;
         FContext.beginPath();
         FContext.fillStyle = Percent.Color;
         FContext.moveTo(cx,cy);
         FContext.arc(cx,cy,Radius,StartAngle,EndAngle);
         FContext.lineTo(cx,cy);
         FContext.fill();
         FContext.closePath();
         StartAngle = EndAngle;
       }     
    
    //Colore centro
    FContext.beginPath();
    FContext.fillStyle = this.Background;
    FContext.arc(MaxRadius , MaxRadius + this.HeightTitle + 3,
                 MaxRadius * this.InternalRadius / 100, 0, 2 * Math.PI, false);
    FContext.fill();
    FContext.closePath();

    // Scritte    
    var YCoord = 2 * MaxRadius + this.HeightTitle + 6;
    var XCoord = (FCanvas.width / 2)- (MaxRadius * this.ExternalRadius / 100);

    for(var Percent of FLsPercent)
    {
      FContext.fillStyle    = Percent.Color;
      FContext.fillRect(XCoord,YCoord,this.WidthBlockLegend,this.RowTextHeight);

      FContext.beginPath(); 
      FContext.fillStyle      = this.FontColor;
      FContext.font           = this.Font;
      FContext.fillText(Percent.Description + ' [' + (Percent.Total == undefined ? Percent.Value + '%]' : Percent.Value + '/' + Percent.Total + ']'), 
                        XCoord + this.WidthBlockLegend + this.SpaceTextLegend,
                        YCoord + this.RowTextHeight - 3);
      FContext.fill();                        
      FContext.closePath();
      YCoord += this.RowTextHeight + 2;
    }
    
  };
  
  this.ClearPercent = function() { FLsPercent = []; };
  
  this.AddPercent = function(Percent) 
  { 
    if(Percent.Name  == undefined)        throw 'Percentuale senza descrittore';
    if(Percent.Value == undefined)        Percent.Value = 10;
    if(Percent.Description == undefined)  Percent.Description = '?????';
    if(Percent.Color == undefined)        Percent.Color = 'red'; 
    FLsPercent.push(Percent);
  };
} 