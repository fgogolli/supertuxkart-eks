import { Stack, StackProps,CfnParameter,SecretValue} from 'aws-cdk-lib';
import { Construct } from 'constructs'
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cdk from 'aws-cdk-lib/core';
import * as cfn from 'aws-cdk-lib/aws-cloudformation';

export class STKPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
  const BUILDX_VER = new CfnParameter(this,"BUILDXVER",{type:"String"});
  const STK_REPO = new CfnParameter(this,"STKREPO",{type:"String"});
  const STK_IMAGE_VERSION = new CfnParameter(this,"STKIMAGEVERSION",{type:"String"});
  const STK_IMAGE_TAG = new CfnParameter(this,"STKIMAGETAG",{type:"String"});
  const STK_IMAGE_AMD_TAG = new CfnParameter(this,"STKIMAGEAMDTAG",{type:"String"});
  const STK_IMAGE_ARM_TAG = new CfnParameter(this,"STKIMAGEARMTAG",{type:"String"});
  const GITHUB_OAUTH_TOKEN = new CfnParameter(this,"GITHUBOAUTHTOKEN",{type:"String"});
  const GITHUB_USER = new CfnParameter(this,"GITHUBUSER",{type:"String"});
  const GITHUB_REPO = new CfnParameter(this,"GITHUBREPO",{type:"String"});
  const GITHUB_BRANCH = new CfnParameter(this,"GITHUBBRANCH",{type:"String"});

  /* uncomment when you test the stack and dont want to manually delete the ecr registry*/
  const stkRegistry = new ecr.Repository(this,`stkRegistry`,{
    repositoryName:STK_REPO.valueAsString,
    imageScanOnPush: true
  });

  // const stkRegistry = ecr.Repository.fromRepositoryName(this,`stkRegistry`,STK_REPO.valueAsString)

  //create a roleARN for codebuild 
  const stkBuildRole = new iam.Role(this, 'stkBuildRole',{
    roleName: "stkBuildRole",
    assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
  });
  
  stkBuildRole.addToPolicy(new iam.PolicyStatement({
    resources: ['*'],
    actions: ['ssm:*'],
  }));

  const githubSecret = new secretsmanager.Secret(this, 'githubSecret', {
    secretObjectValue: {
      token: SecretValue.unsafePlainText(GITHUB_OAUTH_TOKEN.valueAsString)
    },
  });
  const githubOAuthToken = SecretValue.secretsManager(githubSecret.secretArn,{jsonField:'token'});
  new cdk.CfnOutput(this, 'githubOAuthTokenRuntimeOutput1', {
      //value: SecretValue.secretsManager("githubtoken",{jsonField: "token"}).toString()
      value: githubSecret.secretValueFromJson('token').toString()
  });
  new cdk.CfnOutput(this, 'githubOAuthTokenRuntimeOutput2', {
      value: SecretValue.secretsManager(githubSecret.secretArn,{jsonField: "token"}).toString()
  });

  const stkImageArmBuild = new codebuild.Project(this, `stkImageArmBuild`, {
    environment: {privileged:true,buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_ARM_2},
    cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER, codebuild.LocalCacheMode.CUSTOM),
    role: stkBuildRole,
    buildSpec: codebuild.BuildSpec.fromObject(
      {
        version: "0.2",
        env: {
          'exported-variables': [
            'AWS_ACCOUNT_ID','AWS_REGION','STK_REPO','STK_IMAGE_ARM_TAG'
          ],
        },
        phases: {
          build: {
            commands: [
              `export AWS_ACCOUNT_ID="${this.account}"`,
              `export AWS_REGION="${this.region}"`,
              `export STK_REPO="${STK_REPO.valueAsString}"`,
              `export STK_IMAGE_VERSION="${STK_IMAGE_VERSION.valueAsString}"`,
              `export STK_IMAGE_TAG="${STK_IMAGE_ARM_TAG.valueAsString}"`,
              `cd build/server/`,
              `chmod +x ./build.sh && ./build.sh`
            ],
          }
        },
        artifacts: {
          files: ['imageDetail.json']
        },
      }
    ),
  });

  const stkImageAmdBuild = new codebuild.Project(this, `stkImageAmdBuild`, {
    environment: {privileged:true,buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3},
    cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER, codebuild.LocalCacheMode.CUSTOM),
    role: stkBuildRole,
    buildSpec: codebuild.BuildSpec.fromObject(
      {
        version: "0.2",
        env: {
          'exported-variables': [
            'AWS_ACCOUNT_ID','AWS_REGION','STK_REPO','STK_IMAGE_AMD_TAG'
          ],
        },
        phases: {
          build: {
            commands: [
              `export AWS_ACCOUNT_ID="${this.account}"`,
              `export AWS_REGION="${this.region}"`,
              `export STK_REPO="${STK_REPO.valueAsString}"`,
              `export STK_IMAGE_VERSION="${STK_IMAGE_VERSION.valueAsString}"`,
              `export STK_IMAGE_TAG="${STK_IMAGE_AMD_TAG.valueAsString}"`,
              `cd build/server/`,
              `chmod +x ./build.sh && ./build.sh`
            ],
          }
        },
        artifacts: {
          files: ['imageDetail.json']
        },
      }
    ),
  });

  const stkImageAssembly = new codebuild.Project(this, `stkImageAssembly`, {
    environment: {privileged:true,buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_ARM_2},
    cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER, codebuild.LocalCacheMode.CUSTOM),
    role: stkBuildRole,
    buildSpec: codebuild.BuildSpec.fromObject(
      {
        version: "0.2",
        env: {
          'exported-variables': [
            'AWS_ACCOUNT_ID','AWS_REGION','STK_REPO','STK_IMAGE_AMD_TAG','STK_IMAGE_ARM_TAG','STK_IMAGE_TAG'
          ],
        },
        phases: {
          build: {
            commands: [
              `export AWS_ACCOUNT_ID="${this.account}"`,
              `export AWS_REGION="${this.region}"`,
              `export STK_REPO="${STK_REPO.valueAsString}"`,
              `export STK_IMAGE_VERSION="${STK_IMAGE_VERSION.valueAsString}"`,
              `export STK_IMAGE_AMD_TAG="${STK_IMAGE_AMD_TAG.valueAsString}"`,
              `export STK_IMAGE_ARM_TAG="${STK_IMAGE_ARM_TAG.valueAsString}"`,
              `export STK_IMAGE_TAG="${STK_IMAGE_TAG.valueAsString}"`,
              `cd build/server/`,
              `chmod +x ./assemble_multiarch_image.sh && ./assemble_multiarch_image.sh`
            ],
          }
        },
        artifacts: {
          files: ['imageDetail.json']
        },
      }
    ),
  });
    
  //we allow the buildProject principal to push images to ecr
  stkRegistry.grantPullPush(stkImageArmBuild.grantPrincipal);
  stkRegistry.grantPullPush(stkImageAmdBuild.grantPrincipal);
  stkRegistry.grantPullPush(stkImageAssembly.grantPrincipal);

  // here we define our pipeline and put together the assembly line
  const sourceOutput = new codepipeline.Artifact();
  const basebuildpipeline = new codepipeline.Pipeline(this,`BuildSTKPipeline`);
  basebuildpipeline.addStage({
    stageName: 'Source',
    actions: [
      new codepipeline_actions.GitHubSourceAction({
        actionName: 'GitHub_Source',
        owner: GITHUB_USER.valueAsString,
        repo: GITHUB_REPO.valueAsString,
        branch: GITHUB_BRANCH.valueAsString,
        output: sourceOutput,
        oauthToken: SecretValue.secretsManager("githubtoken",{jsonField: "token"}),
        trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
        //oauthToken: SecretValue.unsafePlainText(GITHUB_OAUTH_TOKEN.valueAsString)
      })
      ]
  });

  basebuildpipeline.addStage({
    stageName: 'BuildSTKImages',
    actions: [
      new codepipeline_actions.CodeBuildAction({
        actionName: 'BuildSTKArm64Image',
        input: sourceOutput,
        runOrder: 1,
        project: stkImageArmBuild
      }),
      new codepipeline_actions.CodeBuildAction({
        actionName: 'BuildSTKAmd64Image',
        input: sourceOutput,
        runOrder: 1,
        project: stkImageAmdBuild
      }),
      new codepipeline_actions.CodeBuildAction({
          actionName: 'AssembleSTKBuilds',
          input: sourceOutput,
          runOrder: 2,
          project: stkImageAssembly
        })
    ]
  });
  }
}
