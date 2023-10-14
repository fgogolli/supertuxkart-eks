#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { STKPipelineStack } from './stk-pipeline-stack';

const app = new cdk.App();
new STKPipelineStack(app, 'STKPipelineStack', {
  env: { account: process.env.AWS_ACCOUNT_ID, region: process.env.AWS_REGION},
});
