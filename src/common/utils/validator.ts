import axios from 'axios';

export async function getImgFromKeybase(suffix: string) {
  const defaultValidatorImage = 'validator-default.svg';

  if (!suffix) {
    return defaultValidatorImage;
  }

  const keyBaseUrl = `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${suffix}&fields=pictures`;

  try {
    const response = await axios.get(keyBaseUrl);
    const pictureUrl = response.data.them[0]?.pictures?.primary?.url;

    if (pictureUrl) {
      return pictureUrl;
    }
  } catch (error) {
    console.log(`getImgFromKeybase error: ${error}`);
    throw error;
  }

  return defaultValidatorImage;
}
