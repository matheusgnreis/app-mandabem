const axios = require('axios')
const qs = require('querystring')

module.exports = (apiId, apiKey, order, refId) => {
  // create new shipping tag with Manda Bem WS
  // https://mandabem.com.br/documentacao
  const data = {
    plataforma_id: apiId,
    plataforma_chave: apiKey,
    ref_id: refId || order.number || order._id
  }

  // start parsing order body
  if (order.items) {
    data.produtos = order.items.map(item => ({
      nome: item.name,
      quantidade: item.quantity,
      preco: item.final_price || item.price
    }))
  }
  const buyer = order.buyers && order.buyers[0]
  if (buyer && buyer.registry_type === 'p' && buyer.doc_number) {
    data.cpf_destinatario = buyer.doc_number.replace(/\D/g, '')
  }

  const requests = []
  if (order.shipping_lines) {
    order.shipping_lines.forEach(shippingLine => {
      if (shippingLine.app) {
        // check for valid Correios service
        data.forma_envio = shippingLine.app.service_name
        switch (data.forma_envio) {
          case 'PAC':
          case 'SEDEX':
          case 'PACMINI':
            // parse addresses and package info from shipping line object
            data.destinatario = shippingLine.to.name
            data.cep = shippingLine.to.zip.replace(/\D/g, '')
            data.logradouro = shippingLine.to.street
            data.numero = shippingLine.to.number || 'SN'
            if (shippingLine.to.complement) {
              data.complemento = shippingLine.to.complement
            }
            data.cidade = shippingLine.to.city
            data.estado = shippingLine.to.province_code
            if (shippingLine.package && shippingLine.package.weight) {
              const { value, unit } = shippingLine.package.weight
              data.peso = !unit || unit === 'kg' ? value
                : unit === 'g' ? value * 1000
                  : value * 1000000
              data.altura = 2
              data.largura = 11
              data.comprimento = 16
            }
            if (shippingLine.declared_value) {
              data.valor_seguro = shippingLine.declared_value
            }
            data.cep_origem = shippingLine.from.zip.replace(/\D/g, '')

            // send POST to generate Manda Bem tag
            requests.push(axios.post(
              'https://mandabem.com.br/ws/gerar_envio',
              qs.stringify(data),
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                }
              }
            ).then(response => {
              console.log('> Manda Bem create tag', JSON.stringify(response.data))
              return response
            }).catch(console.error))
        }
      }
    })
  }
  return Promise.all(requests)
}
