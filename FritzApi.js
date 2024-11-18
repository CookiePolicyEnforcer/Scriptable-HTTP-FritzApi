/**
 * This script enables you to communicate with the AHA-HTTP interface using the commands in the official documentation
 * as input arguments. It handles the login process through a user-friendly interface and automatically generates the
 * session ID (sid).
 *
 * Usage:
 * Pass the command and all required parameters (except sid) as arguments to the script.
 *
 * There are two methods to run this script:
 * 1. Set TEST_ARGS_ENABLED = true and provide an object for TEST_ARGS that contains the command and required parameters
 * 2. Use the URL scheme with the following syntax:
 *    scriptable:///run?scriptName=[Name]&switchcmd=[command]&ain=[ain]&param=[param]
 *
 * AVM documentation: https://avm.de/service/schnittstellen/
 *
 * Author: CookiePolicyEnforcer
 * Date: April 2023
 *
 */

// Don't change if not necessary
const CRYPTO = importModule('Crypto-js')       // requires Crypto-js in your Scriptable library
const BOX_URL = 'http://fritz.box'
const LOGIN_SID_ROUTE = '/login_sid.lua?version=2'
const COMMAND_ROUTE = '/webservices/homeautoswitch.lua?'
const SCRIPT_ID = "Fritz"               // Used to store credentials -> must be unique for this script

// Settings -> change to your needs
const REMEMBER_CREDENTIALS = true     // true = credentials will be stored in the keychain
const SHOW_NOTIFICATIONS = true       // true = errors and responses will be shown as notifications
const USE_CELSIUS_ON_OFF = true       // true = use Celsius and "ON"/"OFF" (case-insensitive) as input and output
                                               // false = use Fritz format (16 - 56 (≤8°C - ≥28°C); 253 = OFF; 254 = ON)
const TEST_ARGS_ENABLED = false       // true = TEST_ARGS will be used as arguments
const TEST_ARGS = { ain: '012340000123', switchcmd: 'sethkrtsoll', param: '19.5' }

async function main () {
  try {
    let arguments = getInputArgs()
    arguments = parseArgs(arguments)

    // Authentication
    const loginManager = new LoginManager(SCRIPT_ID, REMEMBER_CREDENTIALS)
    const credentials = await loginManager.getCredentials()
    if (credentials === undefined) return undefined

    const sid = await new SessionID().create(credentials.user, credentials.pass)

    // If REMEMBER_CREDENTIALS = true -> Ask to remember credentials; Else: delete saved credentials
    await loginManager.updateStoredCredentials(credentials.user, credentials.pass)

    // Send API command and get response
    let response = await sendCommand(sid, arguments)
    response = parseResponse(response, arguments.switchcmd)

    showNotification(response)
    Script.setShortcutOutput(response)
  } catch (err) {
    console.error(err)
    showNotification(err)
  }
  Script.complete()
}


/* Returns the arguments passed to the script, either from a shortcut or from the URL scheme.
 * Uses TEST_ARGS instead, if TEST_ARGS_ENABLED = true.
 */
function getInputArgs () {
  if (TEST_ARGS != null && TEST_ARGS_ENABLED) return TEST_ARGS

  let arguments
  // If the script was started using "Run Script" command
  if (args.shortcutParameter != null) arguments = args.shortcutParameter
  // If the script was started using the Scriptable URL scheme
  else if (Object.keys(args.queryParameters).length !== 0) arguments = args.queryParameters

  if (arguments == null) throw new Error('No start arguments were passed to the script')

  if ('scriptName' in arguments) delete arguments.scriptName

  return arguments
}


/* Retrieves the user credentials by showing a login alert or retrieving them from the keychain.
 * Also manages the storage of the credentials in the keychain.
 */
class LoginManager {
  /* scriptID is used for storing the credentials (if rememberCredentials = true) and should be unique for each script.
   * rememberCredentials determines whether the credentials should be stored in the keychain.
   */
  constructor (scriptID, rememberCredentials = true) {
    // scriptID is only necessary for storing credentials
    if(scriptID === undefined && REMEMBER_CREDENTIALS) throw new Error('scriptID is undefined')
    this.SCRIPT_ID = scriptID
    this.REMEMBER_CREDENTIALS = rememberCredentials
  }

  /* Returns a credentials-object {user:'username', pass:'password'} either by showing a login alert or by retrieving.
   * them from the keychain, if REMEMBER_CREDENTIALS = true and there are credentials stored.
   * Returns 'undefined' if the user presses 'cancel' or if there is an error.
   */
  async getCredentials () {
    // Skip LoginAlert if REMEMBER_CREDENTIALS is true and there are credentials stored
    if (this.REMEMBER_CREDENTIALS && this.getRememberedCredentials() !== undefined) {
      return this.getRememberedCredentials()
    }
    else return await this.showLoginAlert()
  }

  /* Displays a login alert and returns a credentials-object {user: username, pass: password}.
   * Returns 'undefined' if the user presses 'cancel'.
   */
  async showLoginAlert () {
    let alert = new Alert()
    alert.title = 'Fritz!Box Login'
    alert.message = 'Please enter your Fritz!Box credentials'
    alert.addTextField('Username')
    alert.addSecureTextField('Password')
    alert.addAction('Login')
    alert.addCancelAction('Cancel')

    let response = await alert.present()

    // If the user presses the 'cancel' button
    if (response === -1) return undefined
    // If the user presses the 'login' button
    else {
      let username = alert.textFieldValue(0)
      let password = alert.textFieldValue(1)
      return { user: username, pass: password }
    }
  }

  /* If REMEMBER_CREDENTIALS = true: Launches a 'Remember Credentials?'-alert and saves the credentials.
   * in the keychain if the user presses 'yes'.
   * If REMEMBER_CREDENTIALS = false: Deletes the credentials from the keychain.
   */
  async updateStoredCredentials (user, pass) {
    if (this.REMEMBER_CREDENTIALS) {
      // If there are no credentials stored yet -> showRememberAlert()
      if (this.getRememberedCredentials() === undefined) {
        let remember = await this.showRememberAlert()
        if (remember) {
          this.saveCredentials(user, pass)
        }
      }
    }
    else {
      this.deleteCredentials()
    }
  }

  // Displays an alert asking to remember credentials. Returns true if the user presses 'yes', false otherwise.
  async showRememberAlert () {
    let alert = new Alert()
    alert.title = 'Remember Credentials?'
    alert.message = 'Do you want to remember your Fritz!Box credentials?'
    alert.addAction('Yes')
    alert.addCancelAction('No')

    let response = await alert.present()

    // If the user presses the 'No' button
    if (response === -1) return false
    // If the user presses the 'Yes' button
    else return true
  }

  // Returns true if the credentials were successfully saved in the keychain, false otherwise.
  saveCredentials(user, pass) {
    try {
      Keychain.set(this.SCRIPT_ID + "user", user)
      Keychain.set(this.SCRIPT_ID + "pass", pass)
    }
    catch (err) {
      return false
    }
    return true
  }

  // Returns true if the credentials were successfully deleted from the keychain, false otherwise.
  deleteCredentials () {
    try {
      Keychain.remove(this.SCRIPT_ID + "user")
      Keychain.remove(this.SCRIPT_ID + "pass")
    } catch (err) {
      return false
    }
    return true
  }

  // Returns a credentials-object {user: username, pass: password} if stored in the keychain, undefined otherwise.
  getRememberedCredentials () {
    try {
      let user = Keychain.get(this.SCRIPT_ID + "user")
      let pass = Keychain.get(this.SCRIPT_ID + "pass")
      return { user: user, pass: pass }
    } catch (err) {
      return undefined
    }
  }
}


// Manages the login process and returns the session id
class SessionID {
  async create (user, pass) {
    try {
      const state = await this.getLoginState()

      let challengeResponse
      if (state.isPbkdf2) {
        console.log('PBKDF2 supported')
        challengeResponse = this.calculatePbkdf2Response(state.challenge, pass)
      } else {
        console.log('Falling back to MD5')
        challengeResponse = this.calculateMd5Response(state.challenge, pass)
      }
      if (state.blockTime > 0) {
        console.log(`Waiting for ${state.blockTime} seconds...`);
        showNotification(`Waiting for ${state.blockTime} seconds...`)

        await new Promise(resolve => {
          Timer.schedule(state.blockTime * 1000, false, () => {
            resolve();
          });
        });
      }

      const sid = await this.sendResponse(user, challengeResponse)
      if (sid === '0000000000000000') {
        throw new Error('Wrong username or password')
      }

      return sid
    } catch (err) {
      const newErrorMessage = 'Failed to login! ' + err.message
      throw new Error(newErrorMessage)
    }
  }

  async getLoginState () {
    let request = new Request(BOX_URL + LOGIN_SID_ROUTE)
    request.method = 'GET'
    let response = await request.loadString()

    const xmlParser = new XMLParser(response)
    let currentElement = null
    let challenge = null
    let blockTime = null
    xmlParser.didStartElement = name => {
      if (name === 'Challenge' || name === 'BlockTime') {
        currentElement = name
      }
    }
    xmlParser.foundCharacters = (value) => {
      if (currentElement === 'Challenge') {
        challenge = value
        currentElement = ''
      }
      if (currentElement === 'BlockTime') {
        blockTime = value
        currentElement = ''
      }
    }

    xmlParser.parse()

    return {
      challenge: challenge,
      blockTime: blockTime,
      isPbkdf2: challenge.startsWith('2$')
    }
  }

  calculatePbkdf2Response (challenge, password) {
    const challengeParts = challenge.split('$')
    const iter1 = Number(challengeParts[1])
    const salt1 = CRYPTO.enc.Hex.parse(challengeParts[2])
    const iter2 = Number(challengeParts[3])
    const salt2 = CRYPTO.enc.Hex.parse(challengeParts[4])

    const hash1 = CRYPTO.PBKDF2(password, salt1, {
      keySize: 256 / 32,
      iterations: iter1,
      hasher: CRYPTO.algo.SHA256,
    })

    const hash2 = CRYPTO.PBKDF2(hash1, salt2, {
      keySize: 256 / 32,
      iterations: iter2,
      hasher: CRYPTO.algo.SHA256,
    })

    return `${challengeParts[4]}$${hash2.toString()}`
  }

  calculateMd5Response (challenge, password) {
    const response = challenge + '-' + password
    const responseBuffer = Buffer.from(response, 'utf16le')
    const md5Sum = CRYPTO.createHash('md5')
    md5Sum.update(responseBuffer)
    return challenge + '-' + md5Sum.digest('hex')
  }

  async sendResponse (username, challengeResponse) {
    let request = new Request(BOX_URL + LOGIN_SID_ROUTE)
    request.method = 'POST'

    const params = {
      username: username,
      response: challengeResponse
    }

    const paramsArray = []
    for (const key in params) {
      paramsArray.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
    }
    request.body = paramsArray.join('&')

    const response = await request.loadString()

    const xmlParser = new XMLParser(response)
    let currentElement = null
    let sid = null
    xmlParser.didStartElement = name => {
      if (name === 'SID') {
        currentElement = name
      }
    }
    xmlParser.foundCharacters = (value) => {
      if (currentElement === 'SID') {
        sid = value
        currentElement = ''
      }
    }
    xmlParser.parse()

    return sid
  }
}


/* Sends a command to the Fritz!Box AHA-HTTP-interface and returns the response.
 * Arguments must be an object with key-value pairs (e.g. { switchcmd: 'sethkrtsoll', param: '28' })
 */
async function sendCommand (sid, arguments) {
  let url = BOX_URL + COMMAND_ROUTE + 'sid=' + sid

  // Loop through all arguments and add them to the url
  for (let key in arguments) {
    url += '&' + key + '=' + arguments[key]
  }

  let request = new Request(url)
  request.method = 'GET'

  let response = null
  try {
    response = await request.loadString()

  } catch (err) {
    throw new Error('Failed to send command! ' + err)
  }
  return response
}


/* Currently only parses the input temp for sethkrtsoll from Celsius to Fritz format if USE_CELSIUS_ON_OFF = true.
 * But could be extended to parse other arguments as well.
 */
function parseArgs (arguments) {
  // sethkrtsoll requires a special temperature format (numbers between 16 and 56; 253 = OFF; 254 = ON)
  if (arguments.switchcmd === 'sethkrtsoll' && USE_CELSIUS_ON_OFF) {
    if (arguments.param != null) {
      let param = arguments.param.toString().toLowerCase()

      if (param === 'off' || param === '0') { param = 253 } else if (param === 'on') { param = 254 }

      arguments.param = celsiusOnOffToFritz(parseFloat(param))
    } else {
      throw new Error('No temperature was passed to the script')
    }
  }

  return arguments
}


// Currently only parses the output temp from Fritz format to Celsius if the option is enabled
function parseResponse (response, switchcmd) {
  if (['gettemperature', 'sethkrtsoll', 'gethkrtsoll', 'gethkrkomfort', 'gethkrabsenk'].includes(switchcmd)
    && USE_CELSIUS_ON_OFF) {
    response = fritzToCelsiusOnOff(response)
    if (typeof response === 'number') {
      response = response + '°C'
    }
    response = "Heater set to " + response
  }

  return "Response: " + response
}


/* Converts a Celsius temperature or "ON" or "OFF" (case-insensitive) to Fritz format (numbers between 16 and 56).
 * Temperatures are rounded to the nearest 0.5 degrees (14,2 -> 14).
 */
function celsiusOnOffToFritz (celsius_temp) {
  if (typeof celsius_temp == 'string') {
    celsius_temp = celsius_temp.toLowerCase()
    if (celsius_temp === 'off') {
      celsius_temp = 253
    } else if (celsius_temp === 'on') {
      celsius_temp = 254
    } else {
      throw new Error('Invalid temperature: ' + celsius_temp + '. Must be a number or \'on\' or \'off\'.')
    }
  }

  let converted = celsius_temp
  if (celsius_temp !== 253 && celsius_temp !== 254) {
    converted = Math.round(converted * 2) / 2
    converted = 16 + (converted - 8) / 0.5
  }

  if (converted < 16) {
    converted = 253
  } else if (converted > 56 && converted !== 253) {
    converted = 254
  }

  return converted
}


/* Converts a temperature in Fritz format (numbers between 16 and 56) back to Celsius.
 * 253 and 254 are converted to "OFF" and "ON".
 */
function fritzToCelsiusOnOff (fritz_temp) {
  fritz_temp = parseInt(fritz_temp)
  let converted = fritz_temp
  if (fritz_temp !== 253 && fritz_temp !== 254) {
    converted = (converted - 16) * 0.5 + 8
  } else if (fritz_temp === 253) {
    converted = 'OFF'
  } else if (fritz_temp === 254) {
    converted = 'ON'
  }
  return converted
}


// Shows a notification if SHOW_NOTIFICATIONS is enabled
function showNotification (message) {
  if (SHOW_NOTIFICATIONS) {
    message = message.toString()
    notification = new Notification()
    notification.title = Script.name()
    notification.body = message
    notification.schedule()
    console.log('Notification: ' + message)
  }
}

await main()