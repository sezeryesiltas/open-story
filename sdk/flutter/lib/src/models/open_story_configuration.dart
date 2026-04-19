class OpenStoryConfiguration {
  const OpenStoryConfiguration({
    required this.clientId,
    required this.staticToken,
    required this.baseUrl,
    this.connectTimeoutMillis = 5000,
    this.readTimeoutMillis = 10000,
  }) : assert(clientId != ""),
       assert(staticToken != ""),
       assert(baseUrl != ""),
       assert(connectTimeoutMillis > 0),
       assert(readTimeoutMillis > 0);

  final String clientId;
  final String staticToken;
  final String baseUrl;
  final int connectTimeoutMillis;
  final int readTimeoutMillis;

  Map<String, Object> toMap() {
    return <String, Object>{
      "clientId": clientId,
      "staticToken": staticToken,
      "baseUrl": baseUrl,
      "connectTimeoutMillis": connectTimeoutMillis,
      "readTimeoutMillis": readTimeoutMillis,
    };
  }
}
