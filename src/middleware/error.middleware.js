export function errorMiddleware() {
    return (err, req, res, next) => {
        if (err && err.message && (err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT') || err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED') || err.message.includes('EHOSTUNREACH') || err.message.includes('ENETUNREACH') || err.message.includes('EAI_AGAIN'))) {
            return res.status(400).json({
                status: 'Error',
                message: 'Network error occurred. Please check your internet connection and try again.'
            });
        }

        if (err.name === 'ServerError') {
            return res.status(500).json({
                status: 'Error',
                message: 'An unexpected error occurred. Please try again later.'
            });
        }

        const errStatus = err.status || 500;
        const errMsg = err.message || 'Something went wrong';
        res.status(errStatus).json({
            status: 'Error',
            message: errMsg,

        })
      
    }
  }