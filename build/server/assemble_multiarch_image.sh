#!/bin/bash

STK_IMAGE=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$STK_REPO:$STK_IMAGE_VERSION-$STK_IMAGE_TAG
STK_ARM_IMAGE=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$STK_REPO:$STK_IMAGE_VERSION-$STK_IMAGE_ARM_TAG
STK_AMD_IMAGE=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$STK_REPO:$STK_IMAGE_VERSION-$STK_IMAGE_AMD_TAG
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $STK_IMAGE

docker manifest create $STK_IMAGE --amend $STK_ARM_IMAGE --amend $STK_AMD_IMAGE

docker manifest annotate --arch arm64 $GAME_SERVER_IMAGE $GAME_ARM_SERVER_IMAGE
docker manifest annotate --arch amd64 $GAME_SERVER_IMAGE $GAME_AMD_SERVER_IMAGE

docker manifest push $STK_IMAGE
