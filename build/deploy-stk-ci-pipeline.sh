#!/bin/bash

source ~/.bash_profile

export AWS_REGION="${AWS_REGION:-$AWS_DEFAULT_REGION}"
export BUILDX_VER="${BUILDX_VER:-v0.11.2}"
export STK_REPO="${STK_REPO:-stk}"
export STK_IMAGE_VERSION="${STK_IMAGE_VERSION:-0.1}"
export STK_IMAGE_TAG="${STK_IMAGE_TAG:-multi}"
export STK_IMAGE_ARM_TAG="${STK_IMAGE_ARM_TAG:-arm64}"
export STK_IMAGE_AMD_TAG="${STK_IMAGE_AMD_TAG:-amd64}"
export GITHUB_USER="${GITHUB_USER:-fgogolli}"
export GITHUB_REPO="${GITHUB_REPO:-supertuxkart-eks}"
export GITHUB_BRANCH="${GITHUB_BRANCH:-kcduk}"

npm install aws-cdk-lib
cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
cdk deploy --app "npx ts-node --prefer-ts-exts ./stk-pipeline.ts"  --parameters BUILDXVER=$BUILDX_VER --parameters STKREPO=$STK_REPO --parameters STKIMAGEVERSION=$STK_IMAGE_VERSION --parameters STKIMAGETAG=$STK_IMAGE_TAG --parameters STKIMAGEAMDTAG=$STK_IMAGE_AMD_TAG --parameters STKIMAGEARMTAG=$STK_IMAGE_ARM_TAG --parameters GITHUBOAUTHTOKEN=$GITHUB_OAUTH_TOKEN --parameters GITHUBREPO=$GITHUB_REPO --parameters GITHUBUSER=$GITHUB_USER --parameters GITHUBBRANCH=$GITHUB_BRANCH
