#!/bin/bash

# This is a simple script to generate 32GB test deals of random data on your miner

# usage: ./generateDeals.sh /mnt/ceph/ 10
for i in {1..$2}
do
   head -c 20GB /dev/urandom > $1/http32GBtestfile$i
   CAR_INPUT=(boostx generate-car $1/http32GBtestfile$i $1/http32GBtestfile$i.car)
   echo "${CAR_INPUT[@]}"
   CAR_OUTPUT="$("${CAR_INPUT[@]}")"
   echo $CAR_OUTPUT
   PAYLOAD_CID="$(echo $CAR_OUTPUT | awk '{split($0,a,": "); print a[2]}')"
   COMMP_INPUT=(boostx commp $1/http32GBtestfile$i.car)
   echo "${COMMP_INPUT[@]}"
   COMMP_OUTPUT="$("${COMMP_INPUT[@]}")"
   echo $COMMP_OUTPUT
   COMMP="$(echo "$COMMP_OUTPUT" | grep 'CommP CID:' | awk '{split($0,a,":  "); print a[2]}')"
   PIECESIZE="$(echo "$COMMP_OUTPUT" | grep 'Piece size:' | awk '{split($0,a,":  "); print a[2]}')"
   CARFILESIZE="$(echo "$COMMP_OUTPUT" | grep 'Car file size:' | awk '{split($0,a,":  "); print a[2]}')"
   DEAL_INPUT=(boost offline-deal --verified=false --provider=$3 --commp=$COMMP --car-size=$CARFILESIZE --piece-size=$PIECESIZE --payload-cid=$PAYLOAD_CID)
   echo "${DEAL_INPUT[@]}"
   DEAL_OUTPUT="$("${DEAL_INPUT[@]}")"
   echo $DEAL_OUTPUT
   UUID="$(echo "$DEAL_OUTPUT" | grep 'deal uuid:' | awk '{split($0,a,": "); print a[2]}')"
   boostd import-data $UUID $1/http32GBtestfile$i.car
   echo $COMMP >> pieces.txt
done
   
