import { useEffect } from 'react';
import Background from '../components/Background';
import '../global.css'

export default ({ Component, pageProps }) => {
  return <>
  <Background/>
<Component {...pageProps} />
  </>
};