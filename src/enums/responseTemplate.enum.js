export function responseTemplate(status, data, message) {

    let responseType = {
        status: status
    }

    if (data)
        responseType.data = data
    if (message)
        responseType.message = message


    return responseType;
}