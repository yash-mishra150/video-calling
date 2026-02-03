
module.exports = (req, res, next) => {
  const start = Date.now();

  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const route = req.path;
    const userAgent = req.get('user-agent');

    console.log(
      `[HTTP] ${method} ${route} - ${status} - ${duration}ms - ${userAgent?.substring(0, 50)}`
    );

    originalSend.call(this, data);
  };

  next();
};
