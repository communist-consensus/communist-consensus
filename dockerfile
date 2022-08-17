FROM alpine:3.15 as build

RUN apk add --no-cache 'nodejs==16.13.2-r0' \
'npm==8.1.3-r0' \
'mysql==10.6.4-r2' \
'wget==1.21.2-r2' \
'python3==3.9.7-r4' \
'make==4.3-r0' \
'gcc==10.3.1_git20211027-r0' \
'g++==10.3.1_git20211027-r0' \
'go-ipfs==0.10.0-r1' \
'nginx==1.20.2-r0'

RUN npm i node-pre-gyp node-gyp -g
RUN wget https://gitee.com/mzdws/communist-consensus/repository/archive/7f1c92ed35a54acbe4c7b4167b20382d0186adff.zip \
&& unzip 7f1c92ed35a54acbe4c7b4167b20382d0186adff.zip \
&& cd communist-consensus-7f1c92ed35a54acbe4c7b4167b20382d0186adff \
&& npm i --unsafe-perms
