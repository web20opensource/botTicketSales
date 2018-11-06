const RtmClient = require('@slack/client').RtmClient;
const MemoryDataStore = require('@slack/client').MemoryDataStore;
const RTM_EVENTS = require('@slack/client').RTM_EVENTS;
const token = process.env.SLACK_TOKEN || '';
const witAppId = process.env.WIT_APP_ID || '';
const witToken = process.env.WIT_ACCESS_TOKEN || '';
const {Wit, log} = require("node-wit");


const wit = new Wit({accessToken: witToken});

const findMissing = (obj) => { 
  witDataMissing = []; 
  for(property in obj){
    if (obj[property]);
    else witDataMissing.push(property);
  }
  return witDataMissing;
}

const witData = {
  location: '',
  when: '',
  duration: '',
  amount:''
};

const rtm = new RtmClient(token, {
  logLevel: 'error',
  // logLevel: 'debug',
  // Initialise a data store for our client, this will load additional helper functions for the storing and retrieval of data
  dataStore: new MemoryDataStore(),
  // Boolean indicating whether Slack should automatically reconnect after an error response
  autoReconnect: true,
  // Boolean indicating whether each message should be marked as read or not after it is processed
  autoMark: true,
});

let state = null;

let user = {
  name: "",
  phone: '',
  address: ''
};

const setState = (newState) => {
  state = newState;
}

const handlers = {};

const router = (message) => {
  if (!state) {
    handlers.DEFAULT(message);
  } else {
    handlers[state](message)
  }
}

handlers.DEFAULT = (message) => {
  rtm.sendMessage("Welcome! What's your name?", message.channel);
  setState("GET_NAME");
}

handlers.GET_NAME = (message) => {
  console.log('get name');
  let name = message.text;
  if ( /^[a-zA-Z]+$/.test(message.text) ){
    rtm.sendMessage("Ok, what's your phone number?", message.channel);
    user.name = message.text; 
    setState("PHONE_NUMBER");
  }else{
    rtm.sendMessage("Please provide a valid name", message.channel);
    setState("GET_NAME");   
  }
}

handlers.PHONE_NUMBER = (message) => {
  console.log('get phone');
  if ( /^[0-9- ]+$/.test(message.text) ){
    rtm.sendMessage("Ok, what's your address?", message.channel);
    user.phone = message.text; 
    setState("COLLECT_ADDRESS");
  }else{
    rtm.sendMessage("Please provide a valid phone number, a.k.a", message.channel);
    setState("PHONE_NUMBER");   
  }
}

handlers.COLLECT_ADDRESS = (message) => {
  console.log('get address');
  if ( /^[a-zA-Z0-9 .#-]+$/.test(message.text) ){
    user.address = message.text; 
    rtm.sendMessage("is this correct: " + JSON.stringify (user), message.channel);
    setState("CONFIRM");   
  }else{
    rtm.sendMessage("Ok,. let's to start again", message.channel);
    setState("COLLECT_ADDRESS");   
  }
}



handlers.CONFIRM = (message) =>{
  console.log('confirm? ' + message.text.toLowerCase()  );
  if (message.text.toLowerCase() == 'yes'){
    if (witData.location){
      setState("storeReservation");
      rtm.sendMessage("Thanks. It's a deal!", message.channel); 
    }
    else{
      setState("getReservationData");
      rtm.sendMessage("Thanks. Let's move to the reservation. Where, when and what's the budget?", message.channel); 
    }
  }else{
    rtm.sendMessage("Let's try again...", message.channel); 
    setState("DEFAULT");
  }
}

handlers.confirmReservationData = (message) => {
  console.log('end of the journey.')
  rtm.sendMessage("Bon voyage, your flight reservation number is: " + (+new Date()),  message.channel); 
}

handlers.getReservationData = (message) =>{
  console.log('get reservation data...');
  wit.message(message.text, {})
        .then((data) => {
          if (data.entities.location){
            witData.location = data.entities.location[0].value;
            console.log('wit thinks the location is: ', data.entities.location[0].value);
          }
          if (data.entities.datetime){
            witData.when = data.entities.datetime[0].value;
            console.log('wit thinks "when" is: ', data.entities.datetime[0].value);
          }

          if (data.entities.duration){
            witData.duration = data.entities.duration[0].value + ' ' + data.entities.duration[0].unit;
            console.log('wit thinks how long is : ', data.entities.duration[0].value + ' ' +data.entities.duration[0].unit);
          }

          if (data.entities.amount_of_money){
            witData.amount = data.entities.amount_of_money[0].value + ' ' + data.entities.amount_of_money[0].unit;
            console.log(data.entities.amount_of_money);
          }

          let missing = findMissing(witData);
          
          if (missing.length){
            rtm.sendMessage("Can you please give me more details on: " + (missing.join(', ')), message.channel);
            setState("getReservationData");
          }
          else{
            rtm.sendMessage("Is this information correct:  " + JSON.stringify(witData), message.channel);
            setState("confirmReservationData"); 
          }

        })
}


/*

  1. add a new handler called GET_NAME
  2. have it collect and store the name of the user
  3. have it set the state to phone number
  4. collect and store the phone number
  5. do the same for collecting an address
  6. confirm with the user the input that you've stored
  7a. if yes, say thanks, and loop back to the beginning,
  7b. otherwise loop back with error

*/

// Listens to all `message` events from the team
rtm.on(RTM_EVENTS.MESSAGE, (message) => {
  if (message.channel === "G79CLHEA3") {
    //console.log('Bot sees a message in general and chooses not to respond.')
  } else {
     router(message);
  }
});

rtm.start();
