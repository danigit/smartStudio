/*
 ***********************************************************
 ** ZCanvasFunct - Funzioni per la gestione delle canvas
 ** Versione 1.0  02 Agosto 2016
 **               - Prima versione  
 ***********************************************************/

    function GetTextHeight(Text,Context)
    {
      var ADiv = document.createElement('div');
      document.body.appendChild(ADiv);
      ADiv.style.font = Context.font;
      ADiv.style.padding = 0;
      ADiv.innerText = Text;
      var Result = ADiv.offsetHeight;
      document.body.removeChild(ADiv);      
      return(Result);
    }
