// read configured E-Com Plus app data
const getAppData = require('./../../lib/store-api/get-app-data')
// create Manda Bem shipping tag
const createMandaBemTag = require('./../../lib/mandabem/create-tag')

const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

exports.post = ({ appSdk }, req, res) => {
  // receiving notification from Store API
  const { storeId } = req

  /**
   * Treat E-Com Plus trigger body here
   * Ref.: https://developers.e-com.plus/docs/api/#/store/triggers/
   */
  const trigger = req.body

  // get app configured options
  let auth, mandaBemId, mandaBemKey
  appSdk.getAuth(storeId)
    .then(_auth => {
      auth = _auth
      return getAppData({ appSdk, storeId, auth })
    })

    .then(appData => {
      mandaBemId = appData.mandabem_id
      mandaBemKey = appData.mandabem_token
      if (mandaBemId && mandaBemKey && trigger.resource === 'orders' && !appData.disable_auto_tag) {
        // handle order fulfillment status changes
        const order = trigger.body
        if (
          order &&
          order.fulfillment_status &&
          order.fulfillment_status.current === 'ready_for_shipping'
        ) {
          // read full order body
          return appSdk.apiRequest(storeId, `/orders/${trigger.resource_id}.json`, 'GET', null, auth)
        }
      }

      // ignore current trigger
      const err = new Error()
      err.name = SKIP_TRIGGER_NAME
      throw err
    })

    .then(({ response }) => {
      // finally create manda bem tag parsing full order data
      const order = response.data
      console.log(`Shipping tag for #${storeId} ${order._id}`)
      return createMandaBemTag(mandaBemId, mandaBemKey, order)
    })

    .then(() => {
      // all done
      res.send(ECHO_SUCCESS)
    })

    .catch(err => {
      if (err.name === SKIP_TRIGGER_NAME) {
        // trigger ignored by app configuration
        res.send(ECHO_SKIP)
      } else {
        // console.error(err)
        // request to Store API with error response
        // return error status code
        res.status(500)
        const { message } = err
        res.send({
          error: ECHO_API_ERROR,
          message
        })
      }
    })
}
