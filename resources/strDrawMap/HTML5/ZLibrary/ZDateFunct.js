/*
 ***********************************************************
 ** ZDateFunct - Gestione delle date
 ** Versione 1.1  18 Agosto 2017
 **               - NEW: Introdotta la funzione che torna la stringa che rappresenta una data in un input HTML
 **               - NEW: Introdotta la possibilità di passare una stringa rappresentante l'ora ad DateFromHTMLInput  
 ** Versione 1.0  02 Agosto 2016
 **               - Prima versione  
 ***********************************************************/
 
const MESI_IN_ITALIANO = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                          'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
                          
const LunghezzaMesi = [31 , 28 , 31 , 30 , 31 , 30 , 31 , 31 , 30 , 31 , 30 , 31];

function ZFormatDateTime(format,dt)
{
  if(dt == undefined) return("");
  
  var pad = function(Stringa,Lunghezza)
  {
    Stringa += ''; // conversione in stringa
    while(Stringa.length < Lunghezza)
          Stringa = '0' + Stringa;
    return(Stringa);
  };
   
  format = format.replace('yyyy', dt.getFullYear());
  format = format.replace('yy',  (dt.getFullYear() + "").substring(2));
  format = format.replace('mm',   pad(dt.getMonth() + 1,2));
  format = format.replace('m',    dt.getMonth() + 1);
  format = format.replace('dd',   pad(dt.getDate(),2));
  format = format.replace('d',    dt.getDate());
  format = format.replace('hh',   pad(dt.getHours(),2));
  format = format.replace('h',    dt.getHours());
  format = format.replace('nn',   pad(dt.getMinutes(),2));
  format = format.replace('n',    dt.getMinutes());
  format = format.replace('ss',   pad(dt.getSeconds(),2));
  format = format.replace('s',    dt.getSeconds());
  format = format.replace('Mi',   MESI_IN_ITALIANO[dt.getMonth()]);
  return format;
}

function ZDateFromJSONString(InputString)
{
 if((InputString != "") && (InputString != undefined) && (InputString != null))
 {
   var Tmp = InputString.split('-');
   return(new Date(Tmp[0],Tmp[1],Tmp[2]));
 }
 else return(undefined);
}

function ZDateFromHTMLInput(DateString,TimeString)
{
 if((DateString != "") && (DateString != undefined) && (DateString != null))
 {
   var TmpData = DateString.split('-');
   if(TimeString == undefined)
      return(new Date(TmpData[0],TmpData[1] - 1,TmpData[2]))
   else
   {
    var TmpOra = TimeString.split(':');
    return(new Date(TmpData[0],TmpData[1] - 1,TmpData[2],TmpOra[0],TmpOra[1]));
   }
 }
 else return(undefined);
}

function ZHTMLInputFromDate(Data)
{
 return(ZFormatDateTime('yyyy-mm-dd',Data));
}

function ZHTMLInputFromTime(Data)
{
 return(ZFormatDateTime('hh:nn',Data));
}

function ZSumMonth(Data,N_Mesi)
{
  var Giorno;
  var Mese;
  var Anno;
  var Result;
  if(N_Mesi == undefined) N_Mesi = 0;
  Anno = Data.getFullYear();
  Mese = Data.getMonth();
  Giorno = Data.getDate();
  while(N_Mesi != 0) 
  {
     if(N_Mesi > 0)
     {
         N_Mesi-- ;
         if(Mese != 11)
            Mese++;
         else
         {
           Mese = 0 ;
           Anno++;
         }
     }
     else
     {
       N_Mesi++; 
       if(Mese != 0)
          Mese--;
       else
       {
         Mese = 11;
         Anno--;
       }
     }
  }
  
  if(( Mese != 1 ) || ( Anno % 4 != 0 )) 
  {
     if(LunghezzaMesi[Mese] < Giorno)
        Giorno = LunghezzaMesi[Mese] ;
  }
  else
  {
     if(29 < Giorno)
       Giorno = 29;
  } 
  return(new Date(Anno,Mese,Giorno));
}

function ZGetDateInJSONFormat(ADate)
{
  var pad = function(Stringa,Lunghezza)
  {
    Stringa += ''; // conversione in stringa
    while(Stringa.length < Lunghezza)
          Stringa = '0' + Stringa;
    return(Stringa);
  };

  return(ADate.getFullYear().toString() + '-' + pad(ADate.getMonth().toString(),2) + '-' + pad(ADate.getDate().toString(),2));
}

// CONVERSIONE HTML INPUT - JSON
function ZStrDateJSONToHTMLInput(InputString)
{
  var pad = function(Stringa,Lunghezza)
  {
    Stringa += ''; // conversione in stringa
    while(Stringa.length < Lunghezza)
          Stringa = '0' + Stringa;
    return(Stringa);
  };

  if((InputString != "") && (InputString != undefined) && (InputString != null))
   {
    var Tmp = InputString.split('-');
    return(Tmp[0] + '-' + pad(Number(Tmp[1]) + Number(1),2) + '-' + Tmp[2]);
   }
   else return(undefined);
}
 
function ZStrDateHTMLInputToJSON(InputString)
{
  var pad = function(Stringa,Lunghezza)
  {
    Stringa += ''; // conversione in stringa
    while(Stringa.length < Lunghezza)
          Stringa = '0' + Stringa;
    return(Stringa);
  };

 if((InputString != "") && (InputString != undefined) && (InputString != null))
 {
   var Tmp = InputString.split('-');
   return(Tmp[0] + '-' + pad(Number(Tmp[1]) - 1,2) + '-' + Tmp[2]);
 }
 else return(undefined);
}

