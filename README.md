# Scriptable-HTTP-FritzApi
Access your AVM Fritz!Box with [Scriptable](https://scriptable.app)! This script enables you to communicate with the AHA-HTTP interface using the commands in the [official documentation](https://avm.de/fileadmin/user_upload/Global/Service/Schnittstellen/AHA-HTTP-Interface.pdf) as input arguments. It handles the login process through a user-friendly interface and automatically generates the session ID (sid).

## Features
- Supports commands from the [official AHA-HTTP interface documentation](https://avm.de/fileadmin/user_upload/Global/Service/Schnittstellen/AHA-HTTP-Interface.pdf)
- Automatically generates the session ID (sid)
- User-friendly login UI with the option to remember credentials
- Option to receive notifications for response and error messages
- Option to use Celsius as temperature unit for relevant commands

## Installation
1. Download both `FritzApi.js` and `crypto-js.js` files and place them in your "Scriptable" folder.
2. Open `FritzApi.js` and modify the settings according to your needs and preferences.

## Usage
This script allows you to send a single command and receive a response on each run. Pass the command and all required parameters as input arguments to the script. The response will be returned as output. See the [official documentation](https://avm.de/fileadmin/user_upload/Global/Service/Schnittstellen/AHA-HTTP-Interface.pdf) for a list of available commands.

You don't need to provide the sid (session ID) as the script automatically handles the authentication process and generates the sid for you.

There are two methods to run this script:
1. Directly in Scriptable with `TEST_ARGS` as input arguments
2. From a Shortcut using the URL scheme

### 1. Run directly with TEST_ARGS
To run the script directly using `TEST_ARGS`, set `TEST_ARGS_ENABLED = true` and provide an object for `TEST_ARGS` that contains the command and all required parameters. Then run the script with Scriptable. This method is useful for testing purposes or if you don't need to change commands frequently.

#### Example
```javascript
TEST_ARGS_ENABLED = true
TEST_ARGS = { ain: '012340000123', switchcmd: 'sethkrtsoll', param: '19.5' }
```
<em>Setting the target temperature to 19.5°C</em>

### 2. URL Scheme
To run the script from a Shortcut, use the Scriptable URL scheme with the following syntax:
```HTML
scriptable:///run?scriptName=[Name]&switchcmd=[command]&ain=[ain]&param=[param]
```
Replace the values in square brackets with your own and ensure they are URL-encoded. Then call the URL using the "Open URLs" action in the Shortcuts app.

#### Example
<p>
 <img src="https://user-images.githubusercontent.com/120395252/230736865-4c9d1323-70be-4a1c-9b48-ac5ddf6a5c22.jpeg" height="200">
 <br/>
 <em>Setting the target temperature to 19.5°C</em>
</p>

## Acknowledgements
- AVM for providing the [AHA-HTTP interface documentation](https://avm.de/service/schnittstellen/) and the [Python script](https://avm.de/fileadmin/user_upload/Global/Service/Schnittstellen/AVM_Technical_Note_-_Session_ID_english_2021-05-03.pdf) for generating the SID
- Simon B. Støvring for creating the [Scriptable app](https://scriptable.app)
