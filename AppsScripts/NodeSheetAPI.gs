// Id somes from url of sheet: https://docs.google.com/spreadsheets/d/{$YOURIDHERE}/
var ourSheet = SpreadsheetApp.openById('{$YOURIDHERE}');

var statSheet = ourSheet.getSheetByName('Stats');
var activitySheet = ourSheet.getSheetByName('Activities to Do');
var movieSheet = ourSheet.getSheetByName('Movies to Watch');

var activitiesToDo = statSheet.getRange('E5').getValue()
var moviesToWatch = statSheet.getRange('C5').getValue()


/**
* Handles requests made by the Node. 
* 
* @param {Object} e The 'activity' or 'movie' request
* @return {String} A string containing the randomly picked movie or activity from our sheet
*/
function doGet(e){
  
  var activity = e.parameter.activity;
  var movie = e.parameter.movie;

  if (activity !== undefined){
    var chosenActivity = Math.floor(Math.random() * activitiesToDo) + 2;
    return ContentService.createTextOutput(activitySheet.getRange('A' + chosenActivity).getValue());
  }

  if (movie !== undefined){
    var chosenMovie = Math.floor(Math.random() * moviesToWatch) + 2;
    return ContentService.createTextOutput(movieSheet.getRange('A' + chosenMovie).getValue());
  }
  
  if (e.parameter.value === undefined) {
    return ContentService.createTextOutput("No value passed as argument to script Url.");
  }
}