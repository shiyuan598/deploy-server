const PORT = 9011;

const database = {
    host: "localhost",
    port: "3306",
    user: "root",
    password: "123456",
    database: "vehicle"
};

const artifacts = {
    USERNAME: "wangshiyuan",
    PASSWORD: "zhito26@#",
    API_KEY: "AKCp8nzqQaRKVZGfYHimkQh9FK3FHq2mkaaRtgJZhjaeYL71aUXU3RTJbFBjNTT9CqNoMTdru",
    BASE_URL: "https://artifactory.zhito.com/artifactory",
    BUILD_JSON:"zhito-ai-module/",
    DOWNLOAD_DIR: "/home/download/",
    EXTRACT_DIR: "/home/extract/"
}

module.exports = {
    PORT,
    database,
    artifacts
};
