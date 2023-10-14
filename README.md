# supertuxkart-eks

## Introduction

This repository contains example code to build the game server images for an open-source game called [SuperTuxKart (STK)](https://supertuxkart.net/Main_Page) for both `amd64` and `arm64` architectures and then deploy/run game servers for STK on top of an EKS Cluster, including automatic scaling using an [Agones](https://agones.dev/site/) fleet and [Karpenter](https://karpenter.sh/) for node scaling. It also utilises [AWS EC2 Spot](https://aws.amazon.com/ec2/spot/?cards.sort-by=item.additionalFields.startDateTime&cards.sort-order=asc&trk=f38fa353-0155-4fcc-8e3d-7d3737b38226&sc_channel=ps&ef_id=Cj0KCQjw4bipBhCyARIsAFsieCxU0KhVeADRCwbGuY4_K5siCsZqUYh2mu3GeukNVNQagvc3XawcthQaApXYEALw_wcB:G:s&s_kwcid=AL!4422!3!517649434549!e!!g!!ec2%20spot!12876304542!122013845032) and [AWS Graviton](https://aws.amazon.com/ec2/graviton/) instances for better price/performance of those game servers.

## Creating the infrastructure

1. Install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [eksctl](https://eksctl.io/installation/) and [Helm](https://helm.sh/docs/intro/install/) using their offician installation docs.
2. Authenticate to an AWS Account with a user account that has permissions to create the required IAM Roles and other resources (ie EKS etc).
3. Create the Karpenter prerequisites:

```
export KARPENTER_VERSION=v0.31.0
export AWS_PARTITION="aws"
export CLUSTER_NAME="kcduk-gameserver-eks"
export AWS_DEFAULT_REGION="eu-west-1"
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export TEMPOUT=$(mktemp)

curl -fsSL https://raw.githubusercontent.com/aws/karpenter/"${KARPENTER_VERSION}"/website/content/en/preview/getting-started/getting-started-with-karpenter/cloudformation.yaml  > $TEMPOUT \
&& aws cloudformation deploy \
  --stack-name "${CLUSTER_NAME}-karpenter" \
  --template-file "${TEMPOUT}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides "ClusterName=${CLUSTER_NAME}"
```

4. Now we can create an EKS Cluster, including an [EKS Managed Node Group](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html) that will be used to run the system components, i.e. Karpenter itself.

```
eksctl update cluster -f - <<EOF
---
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: ${CLUSTER_NAME}
  region: ${AWS_DEFAULT_REGION}
  version: "1.27"
  tags:
    karpenter.sh/discovery: ${CLUSTER_NAME}

iam:
  withOIDC: true
  serviceAccounts:
  - metadata:
      name: karpenter
      namespace: karpenter
    roleName: ${CLUSTER_NAME}-karpenter
    attachPolicyARNs:
    - arn:${AWS_PARTITION}:iam::${AWS_ACCOUNT_ID}:policy/KarpenterControllerPolicy-${CLUSTER_NAME}
    roleOnly: true

iamIdentityMappings:
- arn: "arn:${AWS_PARTITION}:iam::${AWS_ACCOUNT_ID}:role/KarpenterNodeRole-${CLUSTER_NAME}"
  username: system:node:{{EC2PrivateDNSName}}
  groups:
  - system:bootstrappers
  - system:nodes

managedNodeGroups:
- instanceType: m7i.large
  amiFamily: AmazonLinux2
  name: ${CLUSTER_NAME}-ng
  desiredCapacity: 2
  minSize: 2
  maxSize: 6
EOF
```

5. If required, you can enable all of the EKS Logs to go to CloudWatch as below:

```
eksctl utils update-cluster-logging --enable-types=all --region=${AWS_DEFAULT_REGION} --cluster=${CLUSTER_NAME} --approve
```

6. Since we will be utilising Spot instances, we need to give our cluster the required permissions to call the Spot APIs:

```
aws iam create-service-linked-role --aws-service-name spot.amazonaws.com || true
```

7. Now we can deploy Karpenter:

```
export CLUSTER_ENDPOINT="$(aws eks describe-cluster --name ${CLUSTER_NAME} --query "cluster.endpoint" --output text)"
export KARPENTER_IAM_ROLE_ARN="arn:${AWS_PARTITION}:iam::${AWS_ACCOUNT_ID}:role/${CLUSTER_NAME}-karpenter"
echo $CLUSTER_ENDPOINT $KARPENTER_IAM_ROLE_ARN

# Logout of helm registry to perform an unauthenticated pull against the public ECR
helm registry logout public.ecr.aws

helm upgrade --install karpenter oci://public.ecr.aws/karpenter/karpenter --version ${KARPENTER_VERSION} --namespace karpenter --create-namespace \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=${KARPENTER_IAM_ROLE_ARN} \
  --set settings.aws.clusterName=${CLUSTER_NAME} \
  --set settings.aws.defaultInstanceProfile=KarpenterNodeInstanceProfile-${CLUSTER_NAME} \
  --set settings.aws.interruptionQueueName=${CLUSTER_NAME} \
  --set controller.resources.requests.cpu=1 \
  --set controller.resources.requests.memory=1Gi \
  --set controller.resources.limits.cpu=1 \
  --set controller.resources.limits.memory=1Gi \
  --wait
```

8. We will deploy a fleet of game servers for STK using Agones. Therefore, we need to deploy the Agones control plane first via Helm using these commands:

```
helm repo add agones https://agones.dev/chart/stable
helm repo update
kubectl create namespace stk
helm install agones --set "gameservers.namespaces={default,stk}" --set agones.featureGates=PlayerTracking=true --namespace agones-system  --create-namespace agones/agones
```

9. If we would like to add aditional namespaces where we will run game servers, then we can update Agones to manage those resources by running:

```
kubectl create namespace stk2
helm upgrade agones agones/agones --reuse-values --set "gameservers.namespaces={default,stk,stk2}" --namespace agones-system
```

Now we have deployed all the pre-requisite infrastructure to be able to run our game servers!

## Building the SuperTuxKart Game Server

In order to build the STK Game Server images, we can deploy the build pipelines from the `build` directory. In order to do that, follow these steps:

1. Fork this repo or use the existing one.
2. Authenticate to an AWS Account with a user account that has permissions to deploy CDK Pipelines (incl creation of CloudFormation stacks, CodeBuild and CodePipeline).
3. Generate a GitHub Classic Token from your account as per the [official docs](https://docs.github.com/en/enterprise-server@3.6/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
4. Store the generated token in [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) in the same region with a secret name of `githubSecret`. The key name of the secret should be `token` with the value of the token you created.
5. Set the environment variables with the correct values as below:


```
export AWS_REGION=$AWS_DEFAULT_REGION
export BUILDX_VER=v0.11.2
export STK_REPO=stk
export STK_IMAGE_TAG=0.1-multi
export STK_IMAGE_ARM_TAG=0.1-arm64
export STK_IMAGE_AMD_TAG=0.1-amd64
export S3_STK_ASSETS=supertuxkart-assets
export GITHUB_USER=fgogolli
export GITHUB_BRANCH=main
export GITHUB_REPO=supertuxkart-eks
```

6. Get inside the build directory and run the `deploy-stk-ci-pipeline.sh` script.

```
cd build/
./deploy-stk-ci-pipeline.sh
```

7. Upon deploying the pipelines, they will be triggered to run and build the game server images, based on changes to the repo configured above, for both `amd64` and `arm64` architectures and will also create a multi-arch manifest tag, which makes it easier to deploy across different architectures.


## Deploying the STK Game Servers

In order to deploy and run the STK game servers, you can use the deployment scripts under `deploy/cd`.

1. Firstly, lets create the Karpenter provisioners and AWSNodeTemplates that we are gonna use for our STK Game servers.

```
kubectl apply -f deploy/cd/default/karpenter-default.yaml
kubectl apply -f deploy/cd/default/karpenter-gs.yaml
```

2. Now we can deploy the STK Game Servers, using the YAML manifests:

```
kubectl apply -f deploy/cd/default/stk.yaml
```

3. Additional flavours of manifests are available in `deploy/cd/stk` which include different versions of the STK Server image, using the `amd64` and `arm64` architectures, and deployed in their individual fleets.

``` 
kubectl create ns stk
kubectl apply -f deploy/cd/stk/skt-amd64.yaml
kubectl apply -f deploy/cd/stk/skt-arm64.yaml
```

4. Now you can see your running game servers, and connect to them:

```
NAME              STATE   ADDRESS                                    PORT   NODE                                 AGE
stk-fpvb5-xrlrj   Ready   ec2-X-X-X-X.region.compute.amazonaws.com   XXXX   ip-X-X-X-X.region.compute.internal   10s
```

5. Have fun playing with your friends!


## Additional Resources

Below are some additional resources which are either used within or related to this repo:

- Agones - https://agones.dev/site/
- Karpenter - https://karpenter.sh/
- SuperTuxKart - https://supertuxkart.net/Main_Page
- Nakama - https://heroiclabs.com/nakama/
- Agones Game Controller for EKS - https://aws-ia.github.io/terraform-aws-eks-blueprints/patterns/agones-game-controller/
- GameLift FleetIQ Adapter for Agones - https://aws.amazon.com/blogs/gametech/introducing-the-gamelift-fleetiq-adapter-for-agones/
- Open-Match - https://open-match.dev/site/
- Kubectyl - https://github.com/kubectyl
- Game Server Ingress Controller - https://github.com/Octops/gameserver-ingress-controller
