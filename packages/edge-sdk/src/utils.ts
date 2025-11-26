import { parse } from 'tldts';

export const getDomain = (host: string): string => {
  const result = parse(host, { allowPrivateDomains: true });

  if (result.domain) {
    return result.domain;
  }

  return host;
};
