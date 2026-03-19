// Feature: dil-ki-baat
// GitHub Pages SPA config — token यहाँ store करना एक known security tradeoff है
// Production में GitHub Actions secret use करें

const CONFIG = {
    owner: 'github-username',
    repo: 'dil-ki-baat',
    branch: 'main',
    token: 'ghp_your_personal_access_token_here', // GitHub PAT (write scope)
    storiesJsonPath: 'stories.json',
    audioFolder: 'audio',
    baseUrl: 'https://github-username.github.io/dil-ki-baat'
};
